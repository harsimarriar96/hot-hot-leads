import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Lead, Product, SignalsRepository } from '@hothotleads/db';
import type { DashboardOverview } from '@hothotleads/types';

import { DEMO_PRODUCT_SLUG } from '../admin/demo-seed.service';

/** One row of the grouped lead query; counts arrive as strings from pg (bigint). */
export interface LeadStatsRow {
  product_id: string;
  total: number | string;
  hot: number | string;
  warm: number | string;
  cool: number | string;
  unscored: number | string;
  enriched: number | string;
}

/** The minimum each input needs; structural so `summarise()` is testable without entities. */
export interface SummariseInput {
  products: Array<{ id: string; name: string; slug: string }>;
  leadStats: LeadStatsRow[];
  pendingByProduct: Record<string, number>;
  pendingSignals: Array<{
    id: string;
    product: { id: string; name: string };
    company?: string | null;
    type: string;
    description: string;
    detectedAt: Date;
    relevanceScore?: number | null;
  }>;
  hotLeads: Array<{
    id: string;
    product: { id: string; name: string };
    company: string;
    score?: number | null;
    signalSummary?: string | null;
    updatedAt: Date;
  }>;
  signalsEnabled: boolean;
}

const HOT_SCORE = 80;
const HOT_LEADS_LIMIT = 8;
const PENDING_SIGNALS_LIMIT = 6;

/** Pure arithmetic over the raw inputs: totals, pipeline buckets, per-product rows. */
export function summarise(input: SummariseInput): DashboardOverview {
  const statsByProduct = new Map(input.leadStats.map((row) => [row.product_id, row]));
  const pipeline = { hot: 0, warm: 0, cool: 0, unscored: 0 };
  let leads = 0;
  let enrichedLeads = 0;

  const products = input.products.map((p) => {
    const s = statsByProduct.get(p.id);
    const total = Number(s?.total ?? 0);
    const hot = Number(s?.hot ?? 0);
    const enriched = Number(s?.enriched ?? 0);
    leads += total;
    enrichedLeads += enriched;
    pipeline.hot += hot;
    pipeline.warm += Number(s?.warm ?? 0);
    pipeline.cool += Number(s?.cool ?? 0);
    pipeline.unscored += Number(s?.unscored ?? 0);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      leads: total,
      hot,
      pendingSignals: input.signalsEnabled ? (input.pendingByProduct[p.id] ?? 0) : 0,
      enrichedPct: total > 0 ? Math.round((enriched / total) * 100) : null,
    };
  });

  const pendingSignals = input.signalsEnabled
    ? Object.values(input.pendingByProduct).reduce((sum, n) => sum + n, 0)
    : 0;

  return {
    totals: { products: products.length, leads, hotLeads: pipeline.hot, pendingSignals, enrichedLeads },
    pipeline,
    hotLeads: input.hotLeads.map((l) => ({
      id: l.id,
      productId: l.product.id,
      productName: l.product.name,
      company: l.company,
      score: l.score ?? 0,
      signalSummary: l.signalSummary ?? null,
      updatedAt: l.updatedAt.toISOString(),
    })),
    pendingSignals: input.signalsEnabled
      ? input.pendingSignals.map((s) => ({
          id: s.id,
          productId: s.product.id,
          productName: s.product.name,
          company: s.company ?? null,
          type: s.type,
          description: s.description,
          detectedAt: s.detectedAt.toISOString(),
          relevanceScore: s.relevanceScore ?? null,
        }))
      : [],
    products,
    hasDemoData: input.products.some((p) => p.slug === DEMO_PRODUCT_SLUG),
    signalsEnabled: input.signalsEnabled,
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly em: EntityManager,
    private readonly signalsRepo: SignalsRepository,
  ) {}

  async overview(orgId: string, opts: { signalsEnabled: boolean }): Promise<DashboardOverview> {
    const em = this.em.fork();
    const [products, leadStats, hotLeads, pendingByProduct, pendingSignals] = await Promise.all([
      em.find(Product, { organization: orgId }, { orderBy: { name: 'ASC' } }),
      this.leadStats(em, orgId),
      em.find(
        Lead,
        { product: { organization: orgId }, score: { $gte: HOT_SCORE } },
        { orderBy: { score: 'DESC', updatedAt: 'DESC' }, limit: HOT_LEADS_LIMIT, populate: ['product'] },
      ),
      opts.signalsEnabled ? this.signalsRepo.countPendingByProduct(orgId) : Promise.resolve({}),
      opts.signalsEnabled ? this.signalsRepo.listPending(orgId, PENDING_SIGNALS_LIMIT) : Promise.resolve([]),
    ]);
    return summarise({
      products,
      leadStats,
      hotLeads,
      pendingByProduct,
      pendingSignals,
      signalsEnabled: opts.signalsEnabled,
    });
  }

  /** One grouped query over every lead of the organization. */
  private async leadStats(em: EntityManager, orgId: string): Promise<LeadStatsRow[]> {
    const rows = await em.getConnection().execute(
      `select l."product_id",
              count(*) as total,
              count(*) filter (where l."score" >= 80) as hot,
              count(*) filter (where l."score" >= 60 and l."score" < 80) as warm,
              count(*) filter (where l."score" < 60) as cool,
              count(*) filter (where l."score" is null) as unscored,
              count(*) filter (where l."status" <> 'new') as enriched
         from "leads" l
         join "products" p on p."id" = l."product_id"
        where p."organization_id" = ?
        group by l."product_id"`,
      [orgId],
    );
    return rows as LeadStatsRow[];
  }
}
