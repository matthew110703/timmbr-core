import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import { OrderWithRelations } from './order.mapper';

/** Items with their variant / product primary image, for thumbnails. */
const primaryImage = { where: { isPrimary: true }, take: 1, select: { storageKey: true } } as const;
const itemsWithImages = {
  include: {
    variant: { select: { images: primaryImage } },
    product: { select: { images: primaryImage } },
  },
} satisfies Prisma.Order$itemsArgs;

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.OrderCreateInput): Promise<OrderWithRelations> {
    return this.prisma.order.create({
      data,
      include: {
        items: true,
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
      },
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);
  }

  async update(id: string, data: Prisma.OrderUpdateInput): Promise<OrderWithRelations> {
    return this.prisma.order.update({
      where: { id },
      data,
      include: {
        items: true,
        payments: true,
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
