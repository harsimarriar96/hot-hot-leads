import { FilterQuery, raw } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';

import { Signal } from '../entities/signal.entity';
import { Product } from '../entities/product.entity';
import { SignalSource, SignalStatus, SignalType } from '../enums';
import { requireProduct } from './products.repository';

export interface SaveSignalInput {
  productName: string;
  type: SignalType | string;
  source?: SignalSource | string;
  description: string;
  company?: string;
  sourceUrl?: string;
  relevanceScore?: number;
  detectedAt?: Date | string;
  expiresAt?: Date | string;
}

export interface GetSignalsOptions {
  /** Restrict to these review statuses; omitted = every status (dedupe must still see rejected ones). */
  status?: SignalStatus[];
  /**
   * Only the review queue (`pendingSignalWhere`): pending, or snoozed and due. Like the
   * dashboard's queue it has no age cap, so `daysBack` and `status` are ignored.
   */
  review?: boolean;
}

export interface ReviewSignalInput {
  status: SignalStatus;
  userId: string;
  snoozedUntil?: Date;
}

/**
 * Signals waiting for a human decision: `pending`, or `snoozed` past their snooze window,
 * and not expired. Shared by `listPending` and `countPendingByProduct` so they cannot drift.
 */
export function pendingSignalWhere(now: Date = new Date()): FilterQuery<Signal> {
  return {
    $and: [
      {
        $or: [
          { status: SignalStatus.PENDING },
          { status: SignalStatus.SNOOZED, snoozedUntil: { $lte: now } },
        ],
      },
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    ],
  };
}

export class SignalsRepository {
  constructor(private readonly em: EntityManager) {}

  async saveSignal(orgId: string, input: SaveSignalInput): Promise<{ id: string }> {
    const em = this.em.fork();
    const product = await requireProduct(em, orgId, input.productName);

    const detectedAt = input.detectedAt
      ? typeof input.detectedAt === 'string'
        ? new Date(input.detectedAt)
        : input.detectedAt
      : new Date();

    const expiresAt = input.expiresAt
      ? typeof input.expiresAt === 'string'
        ? new Date(input.expiresAt)
        : input.expiresAt
      : undefined;

    const signal = em.create(
      Signal,
      {
        product,
        type: input.type as SignalType,
        source: input.source as SignalSource | undefined,
        description: input.description,
        company: input.company,
        sourceUrl: input.sourceUrl,
        relevanceScore: input.relevanceScore,
        detectedAt,
        expiresAt,
      },
      { partial: true },
    );

    await em.persistAndFlush(signal);
    return { id: signal.id };
  }

  /** Return signals for a product detected within the last `daysBack` days. */
  async getSignals(
    orgId: string,
    productName: string,
    daysBack = 7,
    opts: GetSignalsOptions = {},
  ): Promise<Signal[]> {
    const em = this.em.fork();
    const product = await em.findOne(Product, { organization: orgId, name: productName });
    if (!product) return [];

    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const where: FilterQuery<Signal> = opts.review
      ? { $and: [{ product }, pendingSignalWhere()] }
      : {
          product,
          detectedAt: { $gte: cutoff },
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
          ...(opts.status?.length ? { status: { $in: opts.status } } : {}),
        };
    return em.find(Signal, where, { orderBy: { detectedAt: 'DESC' } });
  }

  /**
   * Record a review decision. The lookup joins through product -> organization, so an id
   * from another tenant is simply `null`. `snoozedUntil` is only kept for `snoozed`.
   */
  async reviewSignal(orgId: string, signalId: string, input: ReviewSignalInput): Promise<Signal | null> {
    const em = this.em.fork();
    const signal = await em.findOne(Signal, { id: signalId, product: { organization: orgId } });
    if (!signal) return null;

    signal.status = input.status;
    signal.reviewedAt = new Date();
    signal.reviewedByUserId = input.userId;
    signal.snoozedUntil = input.status === SignalStatus.SNOOZED ? input.snoozedUntil : undefined;

    await em.flush();
    return signal;
  }

  /** Organization-wide review queue, newest first, with the product populated. */
  async listPending(orgId: string, limit: number): Promise<Signal[]> {
    return this.em.fork().find(
      Signal,
      { $and: [{ product: { organization: orgId } }, pendingSignalWhere()] },
      { orderBy: { detectedAt: 'DESC' }, limit, populate: ['product'] },
    );
  }

  /** Size of the review queue per product id (products with none are absent). */
  async countPendingByProduct(orgId: string): Promise<Record<string, number>> {
    const rows = await this.em
      .fork()
      .createQueryBuilder(Signal, 's')
      .select(['s.product_id', raw('count(*) as count')])
      .where({ $and: [{ product: { organization: orgId } }, pendingSignalWhere()] })
      .groupBy('s.product_id')
      .execute<Array<{ product_id: string; count: string | number }>>('all', false);

    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.product_id] = Number(row.count);
    return counts;
  }

  async findActiveSignals(orgId: string, productId: string): Promise<Signal[]> {
    return this.em.fork().find(
      Signal,
      {
        product: { id: productId, organization: orgId },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      },
      { orderBy: { detectedAt: 'DESC' } },
    );
  }
}
