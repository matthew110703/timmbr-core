import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export const transactionInclude = {
  order: {
    select: {
      id: true,
      status: true,
      shippingAddress: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof transactionInclude;
}>;

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPaginated(
    where: Prisma.PaymentWhereInput,
    page: number,
    limit: number,
  ): Promise<[PaymentWithRelations[], number]> {
    return this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: transactionInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);
  }
}
