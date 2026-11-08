import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { OrderActivityWithRelations, OrderWithRelations } from './order.mapper';

/** Items with their variant / product primary image, for thumbnails. */
const primaryImage = { where: { isPrimary: true }, take: 1, select: { storageKey: true } } as const;
export const itemsWithImages = {
  include: {
    variant: { select: { images: primaryImage } },
    product: { select: { slug: true, images: primaryImage } },
  },
} satisfies Prisma.Order$itemsArgs;

export const invoiceSummarySelect = {
  select: {
    id: true,
    invoiceNumber: true,
    status: true,
    pdfStatus: true,
    issuedAt: true,
  },
} satisfies Prisma.Order$invoiceArgs;

export const activityInclude = {
  staff: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
  notification: true,
} satisfies Prisma.OrderActivityInclude;

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.OrderCreateInput): Promise<OrderWithRelations> {
    return this.prisma.order.create({
      data,
      include: {
        items: itemsWithImages,
        payments: true,
      },
    });
  }

  async findById(id: string): Promise<OrderWithRelations | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        items: itemsWithImages,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        invoice: invoiceSummarySelect,
      },
    });
  }

  /** The user's unexpired PENDING orders for an address, newest first (checkout re-entry). */
  async findLivePendingOrders(
    userId: string,
    shippingAddressId: string,
  ): Promise<OrderWithRelations[]> {
    return this.prisma.order.findMany({
      where: {
        userId,
        shippingAddressId,
        status: OrderStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: {
        items: itemsWithImages,
        payments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async findUserOrders(
    userId: string,
    where: Prisma.OrderWhereInput,
    page = 1,
    limit = 20,
  ): Promise<[OrderWithRelations[], number]> {
    const combinedWhere: Prisma.OrderWhereInput = {
      ...where,
      userId,
    };

    return this.prisma.$transaction([
      this.prisma.order.findMany({
        where: combinedWhere,
        include: {
          items: itemsWithImages,
          payments: {
            orderBy: { createdAt: 'desc' },
          },
          invoice: invoiceSummarySelect,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: combinedWhere }),
    ]);
  }

  async findAdminOrders(
    where: Prisma.OrderWhereInput,
    page = 1,
    limit = 20,
    sortBy: 'createdAt' | 'placedAt' | 'grandTotal' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<[any[], number]> {
    return this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          payments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              status: true,
              provider: true,
            },
          },
          items: {
            take: 1,
            orderBy: { createdAt: 'asc' },
            include: {
              variant: { select: { images: primaryImage } },
              product: { select: { slug: true, images: primaryImage } },
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.order.count({ where: where }),
    ]);
  }

  async getDashboardStats() {
    const paidFilter: Prisma.PaymentListRelationFilter = {
      some: { status: PaymentStatus.PAID },
    };

    const [newOrders, processing, outForDelivery, completed, recentOrders] =
      await this.prisma.$transaction([
        this.prisma.order.count({
          where: {
            status: OrderStatus.CONFIRMED,
            acknowledgedAt: null,
            payments: paidFilter,
          },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.PROCESSING,
            payments: paidFilter,
          },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.SHIPPED,
            payments: paidFilter,
          },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.DELIVERED,
            payments: paidFilter,
          },
        }),
        this.prisma.order.findMany({
          where: {
            status: { not: OrderStatus.PENDING },
            payments: paidFilter,
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            payments: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                status: true,
                provider: true,
              },
            },
            items: {
              take: 1,
              orderBy: { createdAt: 'asc' },
              include: {
                variant: { select: { images: primaryImage } },
                product: { select: { slug: true, images: primaryImage } },
              },
            },
            _count: {
              select: {
                items: true,
              },
            },
          },
        }),
      ]);

    return {
      counts: { newOrders, processing, outForDelivery, completed },
      recentOrders,
    };
  }

  async findOrderActivities(
    orderId: string,
    onlyCustomerVisible = false,
  ): Promise<OrderActivityWithRelations[]> {
    return this.prisma.orderActivity.findMany({
      where: {
        orderId,
        ...(onlyCustomerVisible && { isCustomerVisible: true }),
      },
      include: activityInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, data: Prisma.OrderUpdateInput): Promise<OrderWithRelations> {
    return this.prisma.order.update({
      where: { id },
      data,
      include: {
        items: itemsWithImages,
        payments: true,
        invoice: invoiceSummarySelect,
      },
    });
  }

  async findExpiredPendingOrders(batchSize = 500) {
    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      take: batchSize,
      orderBy: { expiresAt: 'asc' },
      include: {
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
      },
    });
  }
}
