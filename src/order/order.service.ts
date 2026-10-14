import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderRepository } from './order.repository';
import { OrderPricingService } from './order-pricing.service';
import { RazorpayService } from '@/payment/razorpay.service';
import { PaymentRepository } from '@/payment/payment.repository';
import { env } from '@/config/env';
import { byVariantId, compareIds } from '@/common/utils/helpers';
import { CartRepository } from '@/cart/cart.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { CheckoutQuoteDto } from './dto/checkout-quote.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';
import {
  AdminOrderListItemDto,
  CreateOrderResponseDto,
  OrderResponseDto,
  PaymentInitDto,
  PaymentSessionResponseDto,
} from './dto/order-response.dto';
import { OrderCleanupResponseDto } from './dto/order-cleanup-response.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { MediaService } from '@/media/media.service';
import { OrderMapper, OrderWithRelations } from './order.mapper';
import { PaymentMapper } from '@/payment/payment.mapper';
import { PaymentResponseDto } from '@/payment/dto/payment-response.dto';
import {
  OrderAccessForbiddenException,
  OrderNotFoundException,
  OrderNotPayableException,
} from '@/common/exceptions/order.exception';
import { PaymentAmountTooHighException } from '@/common/exceptions/payment.exception';
import { KeyedMutex } from '@/common/utils/keyed-mutex';
import { PaginatedResult } from '@/common/types/api-response.types';
import {
  InventoryTransactionType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import {
  aggregateVariantStockDecrements,
  calculateOrderExpiration,
  convertRupeesToPaise,
  hasSameVariantQuantities,
  MAX_ONLINE_PAYMENT_AMOUNT,
  validateOrderTransition,
} from './order.helper';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRepository: OrderRepository,
    private readonly orderPricingService: OrderPricingService,
    private readonly razorpayService: RazorpayService,
    private readonly paymentRepository: PaymentRepository,
    private readonly cartRepository: CartRepository,
    private readonly mediaService: MediaService,
  ) {}

  /** Public URL for an item thumbnail's storage key. */
  private readonly thumbnailUrl = (key: string) => this.mediaService.getPublicUrl(key);

  async getQuote(userId: string, dto: CheckoutQuoteDto): Promise<QuoteResponseDto> {
    const { pricing } = await this.orderPricingService.calculateQuoteAndValidate(
      userId,
      dto.items,
      dto.shippingAddressId,
    );
    return pricing;
  }

  /**
   * Orders and payment sessions are created one at a time per user (per order), so a double click
   * or a second tab cannot both miss the "open order" lookup and hold the stock twice. This
   * serialises within one process; several instances would need a database lock instead.
   */
  private readonly mutex = new KeyedMutex();

  createOrder(userId: string, dto: CreateOrderDto): Promise<CreateOrderResponseDto> {
    return this.mutex.run(`user:${userId}`, () => this.createOrderUnlocked(userId, dto));
  }

  private async createOrderUnlocked(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<CreateOrderResponseDto> {
    // 0. Checkout re-entry (double click, back button, retry): an unexpired PENDING order for
    //    the same lines and address already holds its stock, so hand that one back instead of
    //    reserving the same stock again.
    const reusable = await this.findReusableOrder(userId, dto);
    if (reusable) {
      const payment = await this.ensurePayment(reusable);
      return { order: OrderMapper.toResponse(reusable), payment };
    }

    // 1. Validate items, address, and calculate pricing
    const { addressSnapshot, calculatedItems, pricing } =
      await this.orderPricingService.calculateQuoteAndValidate(
        userId,
        dto.items,
        dto.shippingAddressId,
      );

    // Razorpay refuses larger orders; say so now instead of after the stock is held.
    if (pricing.grandTotal > MAX_ONLINE_PAYMENT_AMOUNT) {
      throw new PaymentAmountTooHighException(MAX_ONLINE_PAYMENT_AMOUNT);
    }

    const activeCart = await this.cartRepository.findActiveCartByUserId(userId);
    const expiresAt = calculateOrderExpiration(env.ORDER_EXPIRATION_TTL_MINUTES ?? 15);

    // 2. Transactionally reserve inventory, create Order and OrderItems
    const order = await this.prisma.$transaction(async (tx) => {
      // a. Reserve stock in inventory
      for (const item of byVariantId(calculatedItems)) {
        await tx.inventory.update({
          where: { variantId: item.variantId },
          data: {
            reservedQuantity: {
              increment: item.quantity,
            },
          },
        });
      }

      // b. Create Order & OrderItems
      return tx.order.create({
        data: {
          userId,
          cartId: activeCart?.id ?? null,
          status: OrderStatus.PENDING,
          expiresAt,
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          shippingFee: pricing.shippingFee,
          tax: pricing.tax,
          grandTotal: pricing.grandTotal,
          currency: pricing.currency,
          shippingAddressId: dto.shippingAddressId,
          shippingAddress: addressSnapshot,
          items: {
            create: calculatedItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              hsnCode: item.hsnCode,
              gstRate: item.gstRate,
              taxAmount: item.taxAmount,
            })),
          },
        },
        include: {
          items: true,
          payments: true,
        },
      });
    });

    // 3. Create Razorpay order & Payment record.
    //    If either fails, run a compensating transaction to release
    //    reserved stock and cancel the order so it doesn't sit locked.
    let razorpayOrder: Awaited<ReturnType<RazorpayService['createOrder']>>;
    let payment: Awaited<ReturnType<PaymentRepository['create']>>;

    try {
      razorpayOrder = await this.razorpayService.createOrder({
        amount: convertRupeesToPaise(pricing.grandTotal),
        currency: pricing.currency,
        receipt: order.id,
        notes: {
          orderId: order.id,
          userId,
        },
      });

      // 4. Create Payment record in DB
      payment = await this.paymentRepository.create({
        order: { connect: { id: order.id } },
        provider: PaymentProvider.RAZORPAY,
        providerOrderId: razorpayOrder.id,
        amount: pricing.grandTotal,
        currency: pricing.currency,
        status: PaymentStatus.PENDING,
      });
    } catch (error) {
      // Compensating transaction: release reserved stock and cancel order
      this.logger.error(
        `Razorpay/Payment creation failed for order ${order.id}. Running compensation.`,
        error instanceof Error ? error.stack : error,
      );

      await this.prisma.$transaction(async (tx) => {
        for (const item of byVariantId(calculatedItems)) {
          await tx.inventory.update({
            where: { variantId: item.variantId },
            data: {
              reservedQuantity: {
                decrement: item.quantity,
              },
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED },
        });
      });

      throw error;
    }

    return {
      order: OrderMapper.toResponse(order),
      payment: this.toPaymentInit(payment, razorpayOrder.id),
    };
  }

  /**
   * What the client needs to (re)open Razorpay for a PENDING order: used to resume after the
   * modal was dismissed or a payment failed. Starts a fresh Razorpay order when the last
   * attempt can't be continued.
   */
  getPaymentSession(userId: string, orderId: string): Promise<PaymentSessionResponseDto> {
    return this.mutex.run(`user:${userId}`, () => this.getPaymentSessionUnlocked(userId, orderId));
  }

  private async getPaymentSessionUnlocked(
    userId: string,
    orderId: string,
  ): Promise<PaymentSessionResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundException();
    }

    if (order.userId !== userId) {
      throw new OrderAccessForbiddenException();
    }

    const expired = !!order.expiresAt && order.expiresAt.getTime() <= Date.now();
    if (order.status !== OrderStatus.PENDING || expired) {
      throw new OrderNotPayableException();
    }

    return { orderId: order.id, payment: await this.ensurePayment(order) };
  }

  private async findReusableOrder(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<OrderWithRelations | null> {
    const candidates = await this.orderRepository.findLivePendingOrders(
      userId,
      dto.shippingAddressId,
    );
    return candidates.find((order) => hasSameVariantQuantities(order.items, dto.items)) ?? null;
  }

  /** The order's open Razorpay attempt, or a new one when there is none to continue. */
  private async ensurePayment(order: OrderWithRelations): Promise<PaymentInitDto> {
    // A Razorpay order accepts further attempts until it is paid, so a PENDING or FAILED attempt
    // is continued rather than replaced. A second Razorpay order for the same order could end up
    // paid twice.
    const latest = order.payments?.[0];
    if (
      latest?.providerOrderId &&
      (latest.status === PaymentStatus.PENDING || latest.status === PaymentStatus.FAILED)
    ) {
      return this.toPaymentInit(latest, latest.providerOrderId);
    }

    const razorpayOrder = await this.razorpayService.createOrder({
      amount: convertRupeesToPaise(Number(order.grandTotal)),
      currency: order.currency,
      receipt: order.id,
      notes: { orderId: order.id, userId: order.userId },
    });

    const payment = await this.paymentRepository.create({
      order: { connect: { id: order.id } },
      provider: PaymentProvider.RAZORPAY,
      providerOrderId: razorpayOrder.id,
      amount: order.grandTotal,
      currency: order.currency,
      status: PaymentStatus.PENDING,
    });

    return this.toPaymentInit(payment, razorpayOrder.id);
  }

  private toPaymentInit(
    payment: {
      id: string;
      provider: PaymentProvider;
      status: PaymentStatus;
      amount: unknown;
      currency: string;
    },
    razorpayOrderId: string,
  ): PaymentInitDto {
    return {
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      razorpayOrderId,
      razorpayKeyId: this.razorpayService.getKeyId(),
    };
  }

  async getUserOrders(
    userId: string,
    query: GetOrdersQueryDto,
  ): Promise<PaginatedResult<OrderResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = {
      ...(query.status?.length && { status: { in: query.status } }),
    };

    const [orders, total] = await this.orderRepository.findUserOrders(userId, where, page, limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: orders.map((o) => OrderMapper.toResponse(o, this.thumbnailUrl)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getUserOrderById(userId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundException();
    }

    if (order.userId !== userId) {
      throw new OrderAccessForbiddenException();
    }

    return OrderMapper.toResponse(order, this.thumbnailUrl);
  }

  async getUserOrderPayment(userId: string, orderId: string): Promise<PaymentResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundException();
    }

    if (order.userId !== userId) {
      throw new OrderAccessForbiddenException();
    }

    const payment = await this.paymentRepository.findByOrderId(orderId);
    if (!payment) {
      throw new OrderNotFoundException('No payment records associated with this order.');
    }

    return PaymentMapper.toResponse(payment);
  }

  async getAdminOrders(query: GetOrdersQueryDto): Promise<PaginatedResult<AdminOrderListItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = {
      ...(query.status?.length && { status: { in: query.status } }),
      ...(query.userId && { userId: query.userId }),
      ...(query.search && {
        OR: [
          { id: { contains: query.search, mode: 'insensitive' } },
          { shippingAddress: { path: ['phone'], string_contains: query.search } },
          { shippingAddress: { path: ['firstName'], string_contains: query.search } },
          { shippingAddress: { path: ['lastName'], string_contains: query.search } },
        ],
      }),
    };

    const [orders, total] = await this.orderRepository.findAdminOrders(where, page, limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: orders.map((o) => OrderMapper.toAdminListItem(o)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getAdminOrderById(orderId: string): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundException();
    }

    return OrderMapper.toResponse(order, this.thumbnailUrl);
  }

  async updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundException();
    }

    validateOrderTransition(order.status, newStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (newStatus === OrderStatus.CANCELLED) {
        if (order.status === OrderStatus.PENDING) {
          // PENDING → CANCELLED: release reserved stock (stock wasn't deducted yet)
          for (const item of byVariantId(order.items)) {
            if (item.variantId) {
              await tx.inventory.updateMany({
                where: { variantId: item.variantId },
                data: {
                  reservedQuantity: {
                    decrement: item.quantity,
                  },
                },
              });
            }
          }
        } else if (
          order.status === OrderStatus.CONFIRMED ||
          order.status === OrderStatus.PROCESSING
        ) {
          // CONFIRMED/PROCESSING → CANCELLED: restore actual stock
          // (the webhook already deducted quantity and released reservedQuantity)
          for (const item of byVariantId(order.items)) {
            if (item.variantId) {
              const inv = await tx.inventory.findUnique({
                where: { variantId: item.variantId },
              });

              if (inv) {
                const nextQty = inv.quantity + item.quantity;

                await tx.inventory.update({
                  where: { id: inv.id },
                  data: { quantity: nextQty },
                });

                await tx.inventoryTransaction.create({
                  data: {
                    inventoryId: inv.id,
                    type: InventoryTransactionType.RETURN,
                    quantity: item.quantity,
                    quantityBefore: inv.quantity,
                    quantityAfter: nextQty,
                    referenceType: 'ORDER',
                    referenceId: order.id,
                    reason: `Order #${order.id.substring(0, 8)} cancelled — stock restored`,
                  },
                });
              }
            }
          }
        }
      }

      return tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
        include: {
          items: true,
          payments: true,
        },
      });
    });

    return OrderMapper.toResponse(updated);
  }

  async cleanupExpiredOrders(batchSize = 500): Promise<OrderCleanupResponseDto> {
    const expiredOrders = await this.orderRepository.findExpiredPendingOrders(batchSize);

    if (!expiredOrders || expiredOrders.length === 0) {
      this.logger.log('No expired pending orders to cleanup.');
      return { success: true, processedCount: 0, hasMore: false };
    }

    const orderIds = expiredOrders.map((o) => o.id);
    this.logger.log(`Cleaning up ${orderIds.length} expired pending orders.`);

    // Aggregate variant stock decrements across all expired orders
    const variantDecrements = aggregateVariantStockDecrements(expiredOrders);

    // Execute atomic transaction to release reserved stock and cancel orders/payments
    await this.prisma.$transaction(async (tx) => {
      // 1. Release reserved quantities for affected variants (floor at 0)
      for (const [variantId, qtyToRelease] of [...variantDecrements.entries()].sort(([a], [b]) =>
        compareIds(a, b),
      )) {
        const inv = await tx.inventory.findUnique({ where: { variantId } });
        if (inv) {
          await tx.inventory.update({
            where: { variantId },
            data: {
              reservedQuantity: Math.max(0, inv.reservedQuantity - qtyToRelease),
            },
          });
        }
      }

      // 2. Concurrency-guarded update on orders: only cancel if still PENDING
      await tx.order.updateMany({
        where: {
          id: { in: orderIds },
          status: OrderStatus.PENDING,
        },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      // 3. Invalidate associated pending payments
      await tx.payment.updateMany({
        where: {
          orderId: { in: orderIds },
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.CANCELLED,
        },
      });
    });

    this.logger.log(`Successfully cleaned up ${orderIds.length} expired orders.`);
    return {
      success: true,
      processedCount: orderIds.length,
      hasMore: expiredOrders.length === batchSize,
    };
  }
}
