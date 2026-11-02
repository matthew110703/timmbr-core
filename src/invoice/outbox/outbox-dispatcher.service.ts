import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { OutboxEvent, OutboxEventStatus, Prisma } from '@prisma/client';
import {
  buildInvoicePdfJobId,
  GENERATE_INVOICE_PDF_JOB,
  INVOICE_PDF_QUEUE,
  InvoicePdfJobPayload,
  OUTBOX_EVENT_INVOICE_PDF_GENERATE,
} from '../queue/invoice.queue.constants';

export const OUTBOX_DEFAULT_BATCH_SIZE = 25;
export const OUTBOX_DEFAULT_LEASE_MS = 60_000;
export const OUTBOX_DEFAULT_POLL_INTERVAL_MS = 5_000;
export const INVOICE_PDF_MAX_ATTEMPTS = 5;
export const INVOICE_PDF_BACKOFF_DELAY_MS = 3_000;

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private readonly workerId = `outbox-${process.pid}-${randomUUID().slice(0, 8)}`;
  private pollTimer: NodeJS.Timeout | null = null;
  private isDispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(INVOICE_PDF_QUEUE)
    private readonly pdfQueue: Queue<InvoicePdfJobPayload>,
  ) {}

  onModuleInit(): void {
    this.startPolling();
  }

  onModuleDestroy(): void {
    this.stopPolling();
  }

  startPolling(intervalMs = OUTBOX_DEFAULT_POLL_INTERVAL_MS): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.dispatchBatch().catch((err) =>
        this.logger.error({ err, workerId: this.workerId }, 'Outbox poll cycle failed'),
      );
    }, intervalMs);
    this.pollTimer.unref();
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * 1. Transitions any expired `PROCESSING` events (or `PENDING` events) that have already exhausted
   *    `maxAttempts` to `DEAD_LETTER` so they never remain stuck in `PROCESSING` indefinitely.
   * 2. Atomically claims a batch of due `PENDING` or lease-expired `PROCESSING` events using
   *    `FOR UPDATE SKIP LOCKED`.
   * 3. Dispatches each claimed event to BullMQ using a deterministic job ID (`invoice-pdf-${id}-v${ver}`).
   */
  async dispatchBatch(
    batchSize = OUTBOX_DEFAULT_BATCH_SIZE,
    leaseDurationMs = OUTBOX_DEFAULT_LEASE_MS,
  ): Promise<number> {
    if (this.isDispatching) {
      return 0;
    }

    this.isDispatching = true;
    try {
      // Step 1: Move exhausted expired-lease PROCESSING (or exhausted PENDING) events to DEAD_LETTER
      await this.transitionExhaustedEventsToDeadLetter();

      // Step 2: Atomically claim due events with a fresh lease
      const claimedEvents = await this.claimDueEvents(batchSize, leaseDurationMs);
      if (claimedEvents.length === 0) {
        return 0;
      }

      const results = await Promise.all(
        claimedEvents.map((event) => this.publishSingleEventToQueue(event)),
      );

      const publishedIds = results
        .filter((res): res is { id: string; ok: true } => res.ok)
        .map((res) => res.id);

      if (publishedIds.length > 0) {
        const publishedAt = new Date();
        const publishedData = {
          status: OutboxEventStatus.PUBLISHED,
          publishedAt,
          lockedAt: null,
          lockedBy: null,
          leaseExpiresAt: null,
          lastError: null,
        };

        if (typeof this.prisma.outboxEvent.updateMany === 'function') {
          await this.prisma.outboxEvent.updateMany({
            where: { id: { in: publishedIds } },
            data: publishedData,
          });
        } else {
          await Promise.all(
            publishedIds.map((id) =>
              this.prisma.outboxEvent.update({
                where: { id },
                data: publishedData,
              }),
            ),
          );
        }
      }

      return publishedIds.length;
    } finally {
      this.isDispatching = false;
    }
  }

  /**
   * Transitions events that have reached or exceeded `maxAttempts` and whose lease has expired
   * (or are in `PENDING` state) to `DEAD_LETTER`.
   */
  async transitionExhaustedEventsToDeadLetter(): Promise<number> {
    const deadLetteredCount = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "OutboxEvent"
      SET
        "status" = 'DEAD_LETTER'::"OutboxEventStatus",
        "lockedAt" = NULL,
        "lockedBy" = NULL,
        "leaseExpiresAt" = NULL,
        "lastError" = COALESCE("lastError", 'Max outbox attempts exhausted after lease expiry'),
        "updatedAt" = NOW()
      WHERE
        "attempts" >= "maxAttempts"
        AND (
          "status" = 'PENDING'::"OutboxEventStatus"
          OR ("status" = 'PROCESSING'::"OutboxEventStatus" AND "leaseExpiresAt" <= NOW())
        )
    `);

    if (deadLetteredCount > 0) {
      this.logger.warn(
        { deadLetteredCount, workerId: this.workerId },
        'Transitioned exhausted outbox events to DEAD_LETTER',
      );
    }

    return Number(deadLetteredCount);
  }

  /**
   * Atomically claims due `PENDING` events and expired-lease `PROCESSING` events using
   * PostgreSQL `FOR UPDATE SKIP LOCKED`.
   */
  async claimDueEvents(
    batchSize = OUTBOX_DEFAULT_BATCH_SIZE,
    leaseDurationMs = OUTBOX_DEFAULT_LEASE_MS,
  ): Promise<OutboxEvent[]> {
    const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

    return this.prisma.$queryRaw<OutboxEvent[]>(Prisma.sql`
      UPDATE "OutboxEvent"
      SET
        "status" = 'PROCESSING'::"OutboxEventStatus",
        "lockedAt" = NOW(),
        "lockedBy" = ${this.workerId},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "attempts" = "attempts" + 1,
        "updatedAt" = NOW()
      WHERE "id" IN (
        SELECT "id"
        FROM "OutboxEvent"
        WHERE (
          ("status" = 'PENDING'::"OutboxEventStatus" AND "nextAttemptAt" <= NOW())
          OR ("status" = 'PROCESSING'::"OutboxEventStatus" AND "leaseExpiresAt" <= NOW())
        )
        AND "attempts" < "maxAttempts"
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);
  }

  private async publishSingleEventToQueue(
    event: OutboxEvent,
  ): Promise<{ id: string; ok: boolean }> {
    try {
      if (event.eventType === OUTBOX_EVENT_INVOICE_PDF_GENERATE) {
        const rawPayload = (event.payload ?? {}) as Record<string, unknown>;
        const invoiceId =
          typeof rawPayload.invoiceId === 'string' ? rawPayload.invoiceId : event.aggregateId;
        const version =
          typeof rawPayload.version === 'number' && Number.isInteger(rawPayload.version)
            ? rawPayload.version
            : 1;
        const force = Boolean(rawPayload.force);

        const jobId = buildInvoicePdfJobId(invoiceId, version);

        // BullMQ `queue.add` with a deterministic `jobId` is idempotent if the job was already added
        // in a previous attempt that crashed before marking the OutboxEvent as PUBLISHED.
        await this.pdfQueue.add(
          GENERATE_INVOICE_PDF_JOB,
          { invoiceId, version, ...(force && { force: true }) },
          {
            jobId,
            attempts: INVOICE_PDF_MAX_ATTEMPTS,
            backoff: {
              type: 'exponential',
              delay: INVOICE_PDF_BACKOFF_DELAY_MS,
            },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        );
      } else {
        throw new Error(`Unsupported outbox eventType "${event.eventType}"`);
      }

      return { id: event.id, ok: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const exhausted = event.attempts >= event.maxAttempts;
      const backoffMs = Math.min(300_000, Math.pow(2, event.attempts) * 1_000);
      const nextAttemptAt = new Date(Date.now() + backoffMs);

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: exhausted ? OutboxEventStatus.DEAD_LETTER : OutboxEventStatus.PENDING,
          nextAttemptAt,
          lockedAt: null,
          lockedBy: null,
          leaseExpiresAt: null,
          lastError: errorMessage,
        },
      });

      this.logger.error(
        {
          outboxEventId: event.id,
          aggregateId: event.aggregateId,
          attempts: event.attempts,
          maxAttempts: event.maxAttempts,
          exhausted,
          err: errorMessage,
        },
        exhausted
          ? 'Outbox event exhausted maxAttempts and moved to DEAD_LETTER'
          : 'Failed to publish outbox event to BullMQ; scheduled retry with backoff',
      );

      return { id: event.id, ok: false };
    }
  }
}
