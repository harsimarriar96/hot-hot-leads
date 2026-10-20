import { Controller, Get, Query } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  FeedbackEntry,
  LeadsRepository,
  OutreachDraft,
  Product,
  ProductsRepository,
  SignalsRepository,
} from '@hothotleads/db';

@Controller()
export class ReportsController {
  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly leadsRepo: LeadsRepository,
    private readonly signalsRepo: SignalsRepository,
    private readonly em: EntityManager,
  ) {}

  @Get('leads')
  async leads(@Query('product') product: string, @Query('minScore') minScore?: string) {
    if (!product) return { error: 'product query param required' };
    return this.leadsRepo.queryLeads({
      productName: product,
      minScore: minScore ? Number(minScore) : undefined,
      limit: 50,
    });
  }

  @Get('signals')
  async signals(@Query('product') product: string, @Query('days') days?: string) {
    if (!product) return { error: 'product query param required' };
    return this.signalsRepo.getSignals(product, days ? Number(days) : 14);
  }

  @Get('outreach')
  async outreach(@Query('product') product: string) {
    if (!product) return { error: 'product query param required' };
    const em = this.em.fork();
    const productRow = await em.findOne(Product, { name: product });
    if (!productRow) return [];
    const drafts = await em.find(
      OutreachDraft,
      { lead: { product: productRow } },
      { orderBy: { createdAt: 'DESC' }, populate: ['lead'], limit: 50 },
    );
    return drafts.map((d) => ({
      id: d.id,
      leadId: d.lead.id,
      company: d.lead.company,
      contactName: d.lead.contactName,
      channel: d.channel,
      subject: d.subject,
      body: d.body,
      tone: d.tone,
      createdAt: d.createdAt,
    }));
  }

  @Get('feedback/trend')
  async feedbackTrend(@Query('product') product: string, @Query('weeks') weeks?: string) {
    if (!product) return { error: 'product query param required' };
    const em = this.em.fork();
    const productRow = await em.findOne(Product, { name: product });
    if (!productRow) return [];
    const weekCount = Math.max(2, Math.min(52, Number(weeks ?? 8)));
    const cutoff = new Date(Date.now() - weekCount * 7 * 24 * 60 * 60 * 1000);
    const entries = await em.find(
      FeedbackEntry,
      { product: productRow, createdAt: { $gte: cutoff } },
      { orderBy: { createdAt: 'ASC' } },
    );
    // Bucket by ISO week (YYYY-Www). Use Monday as week start.
    const buckets = new Map<string, { count: number; sum: number }>();
    for (const e of entries) {
      const key = isoWeek(e.createdAt);
      const b = buckets.get(key) ?? { count: 0, sum: 0 };
      b.count += 1;
      b.sum += e.qualityScore ?? 0;
      buckets.set(key, b);
    }
    const ordered = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
    return ordered.map(([week, { count, sum }]) => ({
      week,
      avg: count > 0 ? Number((sum / count).toFixed(2)) : 0,
      count,
    }));
  }

  @Get('feedback')
  async feedback(@Query('product') product: string) {
    if (!product) return { error: 'product query param required' };
    const em = this.em.fork();
    const productRow = await em.findOne(Product, { name: product });
    if (!productRow) return [];
    const entries = await em.find(
      FeedbackEntry,
      { product: productRow },
      { orderBy: { createdAt: 'DESC' }, limit: 30 },
    );
    return entries.map((e) => ({
      id: e.id,
      agentType: e.agentType,
      qualityScore: e.qualityScore,
      inputSummary: e.inputSummary,
      outputSummary: e.outputSummary,
      issues: e.issues,
      suggestions: e.suggestions,
      overallAssessment: e.overallAssessment,
      createdAt: e.createdAt,
    }));
  }
}

/** ISO-8601 week key, e.g. "2026-W17". */
function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
