import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { WebhookEvent } from '@prisma/client';

@Injectable()
export class WebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEvent(provider: string, eventId: string): Promise<WebhookEvent | null> {
    return this.prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });
  }

  async recordEvent(data: {
    provider: string;
    eventId: string;
    eventType: string;
    payload: any;
    processedAt?: Date;
  }): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.upsert({
      where: {
        provider_eventId: {
          provider: data.provider,
          eventId: data.eventId,
        },
      },
      update: {
        processedAt: data.processedAt ?? new Date(),
      },
      create: {
        provider: data.provider,
        eventId: data.eventId,
        eventType: data.eventType,
        payload: data.payload,
        processedAt: data.processedAt ?? new Date(),
      },
    });
  }
}
