import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Payment, Prisma } from '@prisma/client';

@Injectable()
export class PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  async findById(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({ where: { id } });
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProviderOrderId(providerOrderId: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({
      where: { providerOrderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id },
      data,
    });
  }
}
