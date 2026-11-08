import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  activityInclude,
  invoiceSummarySelect,
  itemsWithImages,
  OrderRepository,
} from './order.repository';
import { OrderPricingService } from './order-pricing.service';
import { OrderNotificationService } from './queue/order-notification.service';
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
import { DashboardStatsResponseDto } from './dto/dashboard-stats-response.dto';
import {
  CreateOrderActivityDto,
  OrderActivityResponseDto,
  OrderTimelineResponseDto,
} from './dto/order-activity.dto';
import {
  ApproveCancellationDto,
  CancelOrderDto,
  CancelOrderResponseDto,
} from './dto/cancel-order.dto';
import {
  CreateCustomerUpdateDto,
  PREDEFINED_CUSTOMER_UPDATE_TEMPLATES,
} from './dto/create-customer-update.dto';
import { OrderCleanupResponseDto } from './dto/order-cleanup-response.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { MediaService } from '@/media/media.service';
import { OrderMapper, OrderWithRelations } from './order.mapper';
import { PaymentMapper } from '@/payment/payment.mapper';
import { PaymentResponseDto } from '@/payment/dto/payment-response.dto';
import {
  OrderAccessForbiddenException,
  OrderCancellationApprovalNotFoundException,
  OrderCancellationRestrictedException,
  OrderIllegalStateTransitionException,
  OrderInvalidActivityStateException,
  OrderNotFoundException,
  OrderNotPayableException,
} from '@/common/exceptions/order.exception';
import { PaymentAmountTooHighException } from '@/common/exceptions/payment.exception';
import { KeyedMutex } from '@/common/utils/keyed-mutex';
import { PaginatedResult } from '@/common/types/api-response.types';
import { STAFF_PERMISSIONS } from '@/common/constants/permissions.constant';
import {
  InventoryTransactionType,
  InvoiceEmailStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  UserRole,
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
    private readonly orderNotificationService: OrderNotificationService,
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
    const { addressSnapshot, billingAddressSnapshot, calculatedItems, pricing } =
      await this.orderPricingService.calculateQuoteAndValidate(
        userId,
        dto.items,
        dto.shippingAddressId,
        dto.billingAddressId,
        { ensureBillingAddress: true },
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
          shippingAddress: addressSnapshot as unknown as Prisma.InputJsonValue,
          billingAddressId:
            billingAddressSnapshot?.id ?? dto.billingAddressId ?? dto.shippingAddressId,
          billingAddress: (billingAddressSnapshot ??
            addressSnapshot) as unknown as Prisma.InputJsonValue,
          items: {
            create: calculatedItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              originalUnitPrice: item.originalUnitPrice ?? item.unitPrice,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount ?? 0,
              totalPrice: item.totalPrice,
              hsnCode: item.hsnCode,
              gstRate: item.gstRate,
              taxAmount: item.taxAmount,
            })),
          },
        },
        include: {
          items: itemsWithImages,
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
    return (
      candidates.find((order) => {
        if (!hasSameVariantQuantities(order.items, dto.items)) {
          return false;
        }
        if (dto.billingAddressId && order.billingAddressId !== dto.billingAddressId) {
          return false;
        }
        return true;
      }) ?? null
    );
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

  async getDashboardStats(): Promise<DashboardStatsResponseDto> {
    const { counts, recentOrders } = await this.orderRepository.getDashboardStats();
    return {
      counts,
      recentOrders: recentOrders.map((o) => OrderMapper.toAdminListItem(o, this.thumbnailUrl)),
    };
  }

  async getAdminOrders(
    query: GetOrdersQueryDto,
    options?: { enforcePaidOnly?: boolean },
  ): Promise<PaginatedResult<AdminOrderListItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const enforcePaidOnly = Boolean(options?.enforcePaidOnly || query.paidOnly);

    const statusFilter: Prisma.OrderWhereInput['status'] = query.status?.length
      ? {
          in: enforcePaidOnly
            ? query.status.filter((s) => s !== OrderStatus.PENDING)
            : query.status,
        }
      : enforcePaidOnly
        ? { not: OrderStatus.PENDING }
        : undefined;

    const where: Prisma.OrderWhereInput = {
      ...(statusFilter && { status: statusFilter }),
      ...(enforcePaidOnly && {
        payments: {
          some: { status: PaymentStatus.PAID },
        },
      }),
      ...(query.unacknowledgedOnly && { acknowledgedAt: null }),
      ...(query.userId && { userId: query.userId }),
      ...(query.search && {
        OR: [
          { id: { contains: query.search, mode: 'insensitive' } },
          { user: { name: { contains: query.search, mode: 'insensitive' } } },
          { user: { email: { contains: query.search, mode: 'insensitive' } } },
          { user: { phone: { contains: query.search, mode: 'insensitive' } } },
          { shippingAddress: { path: ['phone'], string_contains: query.search } },
          { shippingAddress: { path: ['firstName'], string_contains: query.search } },
          { shippingAddress: { path: ['lastName'], string_contains: query.search } },
        ],
      }),
    };

    const [orders, total] = await this.orderRepository.findAdminOrders(where, page, limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: orders.map((o) => OrderMapper.toAdminListItem(o, this.thumbnailUrl)),
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

  async acknowledgeOrder(orderId: string, staffId: string): Promise<OrderResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: itemsWithImages,
          payments: { orderBy: { createdAt: 'desc' } },
          invoice: invoiceSummarySelect,
        },
      });

      if (!order) {
        throw new OrderNotFoundException();
      }

      if (order.acknowledgedAt) {
        return order;
      }

      if (order.status !== OrderStatus.CONFIRMED) {
        throw new OrderInvalidActivityStateException(
          'Only CONFIRMED orders can be acknowledged by staff.',
        );
      }

      const now = new Date();
      const ackOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          acknowledgedAt: now,
          acknowledgedById: staffId,
        },
        include: {
          items: itemsWithImages,
          payments: { orderBy: { createdAt: 'desc' } },
          invoice: invoiceSummarySelect,
        },
      });

      await tx.orderActivity.create({
        data: {
          orderId,
          staffId,
          eventType: 'ORDER_ACKNOWLEDGED',
          description: 'Order acknowledged by staff.',
          isCustomerVisible: false,
        },
      });

      return ackOrder;
    });

    return OrderMapper.toResponse(updated, this.thumbnailUrl);
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    actor?: {
      userId: string;
      role: UserRole;
      permissions?: string[];
      notes?: string;
      verificationCode?: string;
    },
  ): Promise<OrderResponseDto> {
    if (actor?.role === UserRole.STAFF) {
      if (newStatus === OrderStatus.CANCELLED) {
        throw new OrderInvalidActivityStateException(
          'Use the dedicated order cancellation workflow to cancel orders.',
        );
      }
      if (newStatus === OrderStatus.DELIVERED) {
        const hasDeliverPerm = (actor.permissions ?? []).includes(STAFF_PERMISSIONS.ORDERS_DELIVER);
        if (!hasDeliverPerm) {
          throw new ForbiddenException({
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You do not have permission to mark orders as delivered.',
          });
        }
      }
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundException();
    }

    validateOrderTransition(order.status, newStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (newStatus === OrderStatus.CANCELLED) {
        if (order.status === OrderStatus.PENDING) {
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

      const shouldAutoAcknowledge =
        order.status === OrderStatus.CONFIRMED &&
        newStatus === OrderStatus.PROCESSING &&
        !order.acknowledgedAt &&
        Boolean(actor?.userId);

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          ...(shouldAutoAcknowledge && {
            acknowledgedAt: new Date(),
            acknowledgedById: actor?.userId,
          }),
        },
        include: {
          items: itemsWithImages,
          payments: true,
          invoice: invoiceSummarySelect,
        },
      });

      const eventType =
        newStatus === OrderStatus.SHIPPED
          ? 'ORDER_DISPATCHED'
          : newStatus === OrderStatus.DELIVERED
            ? 'ORDER_DELIVERED'
            : 'STATUS_TRANSITION';

      const defaultDescription =
        newStatus === OrderStatus.SHIPPED
          ? 'Order has been dispatched for delivery.'
          : newStatus === OrderStatus.DELIVERED
            ? 'Order has been delivered to the customer.'
            : `Order status updated to ${newStatus}.`;

      await tx.orderActivity.create({
        data: {
          orderId,
          staffId: actor?.userId ?? null,
          eventType,
          description: actor?.notes?.trim() || defaultDescription,
          isCustomerVisible: true,
          metadata: {
            fromStatus: order.status,
            toStatus: newStatus,
            ...(actor?.verificationCode && { verificationCode: actor.verificationCode }),
          },
        },
      });

      return updatedOrder;
    });

    return OrderMapper.toResponse(updated, this.thumbnailUrl);
  }

  async recordOrderActivity(
    orderId: string,
    staffId: string,
    dto: CreateOrderActivityDto,
  ): Promise<OrderActivityResponseDto> {
    const activity = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new OrderNotFoundException();
      }

      if (dto.idempotencyKey) {
        const existingByKey = await tx.orderActivity.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: activityInclude,
        });
        if (existingByKey) {
          return existingByKey;
        }
      }

      if (dto.eventType === 'MANUFACTURING_STARTED') {
        const existingMfgStarted = await tx.orderActivity.findFirst({
          where: {
            orderId,
            eventType: 'MANUFACTURING_STARTED',
          },
          include: activityInclude,
        });
        if (existingMfgStarted) {
          return existingMfgStarted;
        }
      }

      if (dto.eventType === 'DELIVERY_COORDINATION') {
        if (order.status !== OrderStatus.PROCESSING && order.status !== OrderStatus.SHIPPED) {
          throw new OrderInvalidActivityStateException(
            'Delivery coordination events can only be recorded while the order is PROCESSING or SHIPPED.',
          );
        }
      } else if (order.status !== OrderStatus.PROCESSING) {
        throw new OrderInvalidActivityStateException(
          'Manufacturing events can only be recorded while the order is in PROCESSING status.',
        );
      }

      const defaultDescriptions: Record<string, string> = {
        MATERIAL_PREPARATION: 'Material preparation is underway.',
        MANUFACTURING_STARTED: 'Manufacturing has started on the order.',
        MANUFACTURING_UPDATE: 'Manufacturing progress update recorded.',
        QUALITY_CHECK_COMPLETED: 'Quality inspection completed.',
        READY_FOR_DISPATCH: 'Order is ready for dispatch.',
        DELIVERY_COORDINATION: 'Delivery coordination logged by staff.',
      };

      return tx.orderActivity.create({
        data: {
          orderId,
          staffId,
          eventType: dto.eventType,
          description: dto.description?.trim() || defaultDescriptions[dto.eventType],
          isCustomerVisible: false,
          metadata: (dto.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          idempotencyKey: dto.idempotencyKey ?? null,
        },
        include: activityInclude,
      });
    });

    return OrderMapper.toActivityResponse(activity);
  }

  async getAdminOrderActivities(orderId: string): Promise<OrderTimelineResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) {
      throw new OrderNotFoundException();
    }

    const activities = await this.orderRepository.findOrderActivities(orderId, false);
    const mapped = activities.map((a) => OrderMapper.toActivityResponse(a));
    const hasManufacturingStarted = mapped.some((a) => a.eventType === 'MANUFACTURING_STARTED');

    let pendingCancellationRequest: OrderActivityResponseDto | null = null;
    if (order.status !== OrderStatus.CANCELLED) {
      const latestRequest = [...mapped]
        .reverse()
        .find((a) => a.eventType === 'CANCELLATION_REQUESTED');
      if (latestRequest) {
        pendingCancellationRequest = latestRequest;
      }
    }

    return {
      orderId,
      hasManufacturingStarted,
      pendingCancellationRequest,
      activities: mapped,
    };
  }

  async getUserOrderActivities(
    userId: string,
    orderId: string,
  ): Promise<OrderActivityResponseDto[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });
    if (!order) {
      throw new OrderNotFoundException();
    }
    if (order.userId !== userId) {
      throw new OrderAccessForbiddenException();
    }

    const activities = await this.orderRepository.findOrderActivities(orderId, true);
    return activities.map((a) => OrderMapper.toActivityResponse(a));
  }

  async cancelOrder(
    orderId: string,
    actor: { userId: string; role: UserRole },
    dto: CancelOrderDto,
  ): Promise<CancelOrderResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: itemsWithImages,
          payments: { orderBy: { createdAt: 'desc' } },
          invoice: invoiceSummarySelect,
        },
      });

      if (!order) {
        throw new OrderNotFoundException();
      }

      if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PROCESSING) {
        throw new OrderIllegalStateTransitionException(order.status, OrderStatus.CANCELLED);
      }

      const mfgStarted = await tx.orderActivity.findFirst({
        where: {
          orderId,
          eventType: 'MANUFACTURING_STARTED',
        },
      });

      if (mfgStarted) {
        if (dto.requestApproval) {
          const existingRequest = await tx.orderActivity.findFirst({
            where: {
              orderId,
              eventType: 'CANCELLATION_REQUESTED',
            },
            orderBy: { createdAt: 'desc' },
            include: activityInclude,
          });

          if (existingRequest) {
            return {
              order,
              cancellationState: 'APPROVAL_REQUESTED' as const,
              activity: existingRequest,
              deliveryId: null,
            };
          }

          const requestActivity = await tx.orderActivity.create({
            data: {
              orderId,
              staffId: actor.userId,
              eventType: 'CANCELLATION_REQUESTED',
              description: `Cancellation requested (${dto.reason})`,
              isCustomerVisible: false,
              metadata: {
                reason: dto.reason,
                internalNotes: dto.internalNotes ?? null,
                approvalStatus: 'PENDING',
              },
            },
            include: activityInclude,
          });

          return {
            order,
            cancellationState: 'APPROVAL_REQUESTED' as const,
            activity: requestActivity,
            deliveryId: null,
          };
        }

        throw new OrderCancellationRestrictedException();
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: {
          items: itemsWithImages,
          payments: { orderBy: { createdAt: 'desc' } },
          invoice: invoiceSummarySelect,
        },
      });

      const shipping = (order.shippingAddress ?? {}) as Record<string, unknown>;
      const customerEmail = order.user?.email || (shipping.email as string | undefined) || null;

      const cancelActivity = await tx.orderActivity.create({
        data: {
          orderId,
          staffId: actor.userId,
          eventType: 'CANCELLATION_EXECUTED',
          description: `Order cancelled (${dto.reason})`,
          isCustomerVisible: true,
          metadata: {
            reason: dto.reason,
            internalNotes: dto.internalNotes ?? null,
          },
          ...(customerEmail && {
            notification: {
              create: {
                orderId,
                channel: 'EMAIL',
                recipient: customerEmail,
                status: InvoiceEmailStatus.PENDING,
              },
            },
          }),
        },
        include: activityInclude,
      });

      return {
        order: updatedOrder,
        cancellationState: 'CANCELLED' as const,
        activity: cancelActivity,
        deliveryId: cancelActivity.notification?.id ?? null,
      };
    });

    if (result.deliveryId) {
      await this.orderNotificationService
        .enqueueDeliveryJob(orderId, result.deliveryId)
        .catch((err: unknown) =>
          this.logger.error(
            { err, orderId, deliveryId: result.deliveryId },
            'Failed to enqueue cancellation email notification',
          ),
        );
    }

    return {
      order: OrderMapper.toResponse(result.order, this.thumbnailUrl),
      cancellationState: result.cancellationState,
      activity: OrderMapper.toActivityResponse(result.activity),
    };
  }

  async approveCancellation(
    orderId: string,
    managerId: string,
    dto: ApproveCancellationDto,
  ): Promise<CancelOrderResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: itemsWithImages,
          payments: { orderBy: { createdAt: 'desc' } },
          invoice: invoiceSummarySelect,
        },
      });

      if (!order) {
        throw new OrderNotFoundException();
      }

      if (order.status === OrderStatus.CANCELLED) {
        const existingApproved = await tx.orderActivity.findFirst({
          where: { orderId, eventType: 'CANCELLATION_APPROVED' },
          orderBy: { createdAt: 'desc' },
          include: activityInclude,
        });
        if (existingApproved) {
          return {
            order,
            cancellationState: 'CANCELLED' as const,
            activity: existingApproved,
            deliveryId: null,
          };
        }
      }

      if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PROCESSING) {
        throw new OrderIllegalStateTransitionException(order.status, OrderStatus.CANCELLED);
      }

      const pendingRequest = await tx.orderActivity.findFirst({
        where: {
          orderId,
          eventType: 'CANCELLATION_REQUESTED',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!pendingRequest) {
        throw new OrderCancellationApprovalNotFoundException();
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: {
          items: itemsWithImages,
          payments: { orderBy: { createdAt: 'desc' } },
          invoice: invoiceSummarySelect,
        },
      });

      const reqMeta = (pendingRequest.metadata ?? {}) as Record<string, unknown>;
      const reason = (reqMeta.reason as string) ?? 'Approved by manager';
      const shipping = (order.shippingAddress ?? {}) as Record<string, unknown>;
      const customerEmail = order.user?.email || (shipping.email as string | undefined) || null;

      const approvedActivity = await tx.orderActivity.create({
        data: {
          orderId,
          staffId: managerId,
          eventType: 'CANCELLATION_APPROVED',
          description: `Order cancellation approved (${reason})`,
          isCustomerVisible: true,
          metadata: {
            requestId: pendingRequest.id,
            reason,
            resolutionNotes: dto.resolutionNotes ?? null,
          },
          ...(customerEmail && {
            notification: {
              create: {
                orderId,
                channel: 'EMAIL',
                recipient: customerEmail,
                status: InvoiceEmailStatus.PENDING,
              },
            },
          }),
        },
        include: activityInclude,
      });

      return {
        order: updatedOrder,
        cancellationState: 'CANCELLED' as const,
        activity: approvedActivity,
        deliveryId: approvedActivity.notification?.id ?? null,
      };
    });

    if (result.deliveryId) {
      await this.orderNotificationService
        .enqueueDeliveryJob(orderId, result.deliveryId)
        .catch((err: unknown) =>
          this.logger.error(
            { err, orderId, deliveryId: result.deliveryId },
            'Failed to enqueue approved cancellation email notification',
          ),
        );
    }

    return {
      order: OrderMapper.toResponse(result.order, this.thumbnailUrl),
      cancellationState: result.cancellationState,
      activity: OrderMapper.toActivityResponse(result.activity),
    };
  }

  async createCustomerUpdate(
    orderId: string,
    staffId: string,
    dto: CreateCustomerUpdateDto,
  ): Promise<OrderActivityResponseDto> {
    const resolvedMessage =
      dto.message?.trim() ||
      (dto.templateKey ? PREDEFINED_CUSTOMER_UPDATE_TEMPLATES[dto.templateKey] : undefined);

    if (!resolvedMessage) {
      throw new BadRequestException({
        code: 'CUSTOMER_UPDATE_MESSAGE_REQUIRED',
        message: 'A message or valid predefined templateKey is required for a customer update.',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      if (!order) {
        throw new OrderNotFoundException();
      }

      if (dto.idempotencyKey) {
        const existing = await tx.orderActivity.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: activityInclude,
        });
        if (existing) {
          return { activity: existing, deliveryId: null };
        }
      }

      const shipping = (order.shippingAddress ?? {}) as Record<string, unknown>;
      const customerEmail = order.user?.email || (shipping.email as string | undefined) || null;
      const shouldNotify = Boolean(dto.notifyCustomer && customerEmail);

      const activity = await tx.orderActivity.create({
        data: {
          orderId,
          staffId,
          eventType: 'CUSTOMER_UPDATE',
          updateCategory: dto.category,
          description: resolvedMessage,
          isCustomerVisible: true,
          idempotencyKey: dto.idempotencyKey ?? null,
          metadata: {
            templateKey: dto.templateKey ?? null,
            notifyCustomer: Boolean(dto.notifyCustomer),
          },
          ...(shouldNotify &&
            customerEmail && {
              notification: {
                create: {
                  orderId,
                  channel: 'EMAIL',
                  recipient: customerEmail,
                  status: InvoiceEmailStatus.PENDING,
                },
              },
            }),
        },
        include: activityInclude,
      });

      return {
        activity,
        deliveryId: activity.notification?.id ?? null,
      };
    });

    if (result.deliveryId) {
      await this.orderNotificationService
        .enqueueDeliveryJob(orderId, result.deliveryId)
        .catch((err: unknown) =>
          this.logger.error(
            { err, orderId, deliveryId: result.deliveryId },
            'Failed to enqueue customer update email notification',
          ),
        );
    }

    return OrderMapper.toActivityResponse(result.activity);
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
