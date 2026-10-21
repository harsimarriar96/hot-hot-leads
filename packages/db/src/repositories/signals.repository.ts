import { EntityManager } from '@mikro-orm/postgresql';

import { Signal } from '../entities/signal.entity';
import { Product } from '../entities/product.entity';
import { SignalSource, SignalType } from '../enums';
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
  async getSignals(orgId: string, productName: string, daysBack = 7): Promise<Signal[]> {
    const em = this.em.fork();
    const product = await em.findOne(Product, { organization: orgId, name: productName });
    if (!product) return [];

    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    return em.find(
      Signal,
      {
        product,
        detectedAt: { $gte: cutoff },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      },
      { orderBy: { detectedAt: 'DESC' } },
    );
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
