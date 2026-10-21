import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  AgentType,
  FeedbackEntry,
  Lead,
  LeadStatus,
  Organization,
  OutreachDraft,
  OutreachTone,
  PredefinedProspect,
  Product,
  ProductIcp,
  ProductSalesChannel,
  ProductSource,
  Schedule,
  ScheduleChannel,
  ScheduleFrequency,
  Signal,
  SignalSource,
  SignalType,
  SourceType,
  User,
} from '@hothotleads/db';

import { EntitlementsService } from '../auth/entitlements.service';
import type { OrgContext } from '../auth/tenant-context';

const DEMO_PRODUCT_NAME = 'Acme AI';
const DEMO_PRODUCT_SLUG = 'acme-ai';

@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Idempotent: tears down any prior demo product in this organization and rebuilds. */
  async seed(ctx: OrgContext): Promise<{ productId: string; counts: Record<string, number> }> {
    const em = this.em.fork();
    const organization = em.getReference(Organization, ctx.org.id);
    const createdBy = (await em.findOne(User, { id: ctx.user.id })) ?? undefined;

    // Reset — cascade via FK wipes everything owned by the demo product.
    const existing = await em.findOne(Product, { organization, slug: DEMO_PRODUCT_SLUG });
    // Replacing the demo product does not consume a new seat.
    await this.entitlements.assertCanCreateProduct(ctx, existing ? -1 : 0);
    if (existing) {
      em.remove(existing);
      await em.flush();
    }

    const product = em.create(
      Product,
      {
        organization,
        name: DEMO_PRODUCT_NAME,
        slug: DEMO_PRODUCT_SLUG,
        generalInfo:
          'Agentic GTM engine. Finds, enriches, scores, and drafts outreach for B2B SaaS accounts with active buying signals.',
        salesStrategy:
          'Inbound-to-outbound: ICP-match inbound signups get warm outreach in 4h; outbound targets Series A–B with recent hiring in GTM roles.',
        pricing: '$2k / month starter · $5k / month scale. Annual contracts only.',
      },
      { partial: true },
    );

    em.create(
      ProductIcp,
      {
        product,
        targetIndustries: ['fintech', 'SaaS', 'dev tools', 'security'],
        companySizes: ['50-200', '200-1000'],
        fundingStages: ['Seed', 'Series A', 'Series B'],
        geographies: ['US', 'EU', 'UK'],
        notes:
          'VP+ buyers in GTM/revenue. Recently hired SDRs or a VP Sales is a strong buying signal. Anti-ICP: pre-seed, <$1M ARR, consumer.',
      },
      { partial: true },
    );

    const channels = [
      { name: 'Cold email', description: 'Warmed domain, 2-step sequence.' },
      { name: 'LinkedIn DM', description: 'Contact must match Head-of-GTM persona.' },
      { name: 'Partner referral', description: 'Intro via portfolio-company partners.' },
    ];
    for (const c of channels) {
      em.create(ProductSalesChannel, { product, ...c }, { partial: true });
    }

    const sources = [
      { name: 'TechCrunch funding', url: 'https://techcrunch.com/category/venture/', type: SourceType.NEWS },
      { name: 'Lenny\'s Newsletter', url: 'https://www.lennysnewsletter.com/', type: SourceType.NEWSLETTER },
      { name: 'Crunchbase daily', url: 'https://www.crunchbase.com/', type: SourceType.DATABASE },
      { name: 'Twitter — GTM list', url: 'https://twitter.com', type: SourceType.SOCIAL },
    ];
    for (const s of sources) {
      em.create(ProductSource, { product, ...s }, { partial: true });
    }

    const prospects = [
      { company: 'Vertical Labs', domain: 'verticallabs.com', industry: 'SaaS', companySize: '50-200', fundingStage: 'Series A', icpFitNotes: 'VP Sales hired last month' },
      { company: 'Merkle Systems', domain: 'merklesys.io', industry: 'dev tools', companySize: '200-1000', fundingStage: 'Series B', icpFitNotes: 'Exposed PLG motion; opening enterprise GTM' },
      { company: 'Ampersand Security', domain: 'ampersand.ai', industry: 'security', companySize: '50-200', fundingStage: 'Series A', icpFitNotes: 'Landed large design-partner; expanding outbound' },
    ];
    for (const p of prospects) {
      em.create(PredefinedProspect, { product, ...p }, { partial: true });
    }

    const leads = buildDemoLeads(product);
    for (const input of leads) {
      em.create(Lead, input, { partial: true });
    }
    await em.flush();

    // Outreach drafts need leads persisted first.
    const persistedLeads = await em.find(Lead, { product }, { orderBy: { score: 'DESC' } });
    const topThree = persistedLeads.slice(0, 3);
    for (const lead of topThree) {
      em.create(
        OutreachDraft,
        {
          lead,
          channel: 'Cold email',
          subject: `Quick one about ${lead.company}'s GTM motion`,
          body: `Hi ${lead.contactName ?? 'there'},\n\nNoticed ${lead.company} just ${
            lead.signals[0] ?? 'expanded the team'
          }. We help teams at that inflection ship outbound in 2 weeks instead of 2 quarters. Worth 15 min?\n\n— Taylor`,
          tone: OutreachTone.FRIENDLY,
        },
        { partial: true },
      );
    }

    const signals = buildDemoSignals(product);
    for (const input of signals) {
      em.create(Signal, input, { partial: true });
    }

    const feedback = buildDemoFeedback(product);
    for (const input of feedback) {
      em.create(FeedbackEntry, input, { partial: true });
    }

    const schedules = [
      {
        organization,
        createdBy,
        product,
        name: 'Daily prospect discovery',
        taskPrompt: `Generate 5 new leads for ${product.name} matching current ICP`,
        frequency: ScheduleFrequency.DAILY,
        userId: 'demo',
        chatId: 'demo',
        channel: ScheduleChannel.TELEGRAM,
        enabled: true,
      },
      {
        organization,
        createdBy,
        product,
        name: 'Weekly signal sweep',
        taskPrompt: `Check signals for ${product.name} from last 14 days`,
        frequency: ScheduleFrequency.WEEKLY,
        userId: 'demo',
        chatId: 'demo',
        channel: ScheduleChannel.TELEGRAM,
        enabled: true,
      },
    ];
    for (const input of schedules) {
      em.create(Schedule, input, { partial: true });
    }

    await em.flush();

    const counts = {
      leads: persistedLeads.length,
      outreach_drafts: topThree.length,
      signals: signals.length,
      feedback: feedback.length,
      schedules: schedules.length,
      channels: channels.length,
      sources: sources.length,
      prospects: prospects.length,
    };
    this.logger.log(`Demo seed complete · ${JSON.stringify(counts)}`);
    return { productId: product.id, counts };
  }
}

function buildDemoLeads(product: Product): Array<Record<string, unknown>> {
  const templates: Array<Partial<Lead>> = [
    { company: 'Verge Data', domain: 'vergedata.com', industry: 'dev tools', companySize: '50-200', fundingStage: 'Series A', contactName: 'Priya Rao', contactTitle: 'VP Sales', score: 92, buyingIntent: 88, status: LeadStatus.OUTREACH_READY, icpFitReason: 'Recent VP Sales hire, Series A, fintech-adjacent dev tools — textbook ICP.', signalSummary: 'VP Sales hired 2 weeks ago. Posted 4 SDR roles.', signals: ['hiring_org', 'funding'] },
    { company: 'Lumen Stack', domain: 'lumenstack.io', industry: 'SaaS', companySize: '200-1000', fundingStage: 'Series B', contactName: 'James Okafor', contactTitle: 'Head of Revenue', score: 88, buyingIntent: 81, status: LeadStatus.OUTREACH_READY, icpFitReason: 'Series B, GTM-heavy hiring, US+EU presence.', signalSummary: 'Opened EU office. Hiring Head of EU Sales.', signals: ['company_activity', 'hiring_org'] },
    { company: 'Kite Security', domain: 'kite.sh', industry: 'security', companySize: '50-200', fundingStage: 'Series A', contactName: 'Morgan Beck', contactTitle: 'COO', score: 84, buyingIntent: 77, status: LeadStatus.OUTREACH_READY, icpFitReason: 'Just raised; building outbound from zero.', signalSummary: '$18M Series A last month.', signals: ['funding'] },
    { company: 'Quanta Labs', domain: 'quanta.ai', industry: 'dev tools', companySize: '50-200', fundingStage: 'Series A', contactName: 'Sora Im', contactTitle: 'CEO', score: 78, buyingIntent: 64, status: LeadStatus.SCORED, icpFitReason: 'Good fit on industry + stage. Unclear on urgency.', signalSummary: 'Launched v2 product last week.', signals: ['product_launch'] },
    { company: 'Fenway Analytics', domain: 'fenway.co', industry: 'fintech', companySize: '50-200', fundingStage: 'Seed', contactName: 'Alex Russo', contactTitle: 'Founder', score: 72, buyingIntent: 58, status: LeadStatus.SCORED, icpFitReason: 'Seed stage — edge of ICP. Strong market.', signalSummary: 'Published thought-leadership piece on embedded finance.', signals: ['content_social'] },
    { company: 'Halo Route', domain: 'haloroute.com', industry: 'logistics', companySize: '200-1000', fundingStage: 'Series B', contactName: 'Keshia Lang', contactTitle: 'VP GTM', score: 68, buyingIntent: 52, status: LeadStatus.SCORED, icpFitReason: 'Adjacent industry; may not convert.', signalSummary: 'Reorg announced, new CRO.', signals: ['leadership_change'] },
    { company: 'Parallax Studios', domain: 'parallaxstudios.io', industry: 'SaaS', companySize: '50-200', fundingStage: 'Series A', contactName: 'Dev Patel', contactTitle: 'Head of Growth', score: 64, buyingIntent: 50, status: LeadStatus.ENRICHED },
    { company: 'Sextant Health', domain: 'sextanthealth.com', industry: 'healthtech', companySize: '50-200', fundingStage: 'Series A', contactName: 'Kelly Tran', contactTitle: 'VP Sales', score: 61, buyingIntent: 48, status: LeadStatus.ENRICHED, icpFitReason: 'Not primary industry. Strong GTM hire though.', signals: ['hiring_org'] },
    { company: 'Obsidian Freight', domain: 'obsidianfreight.com', industry: 'logistics', companySize: '200-1000', fundingStage: 'Series B', contactName: 'Chen Wu', contactTitle: 'COO', score: 58, buyingIntent: 44, status: LeadStatus.ENRICHED },
    { company: 'Northwind Partners', domain: 'northwind.vc', industry: 'finance', companySize: '10-50', fundingStage: 'n/a', contactName: 'Stuart Finch', contactTitle: 'Partner', score: 54, buyingIntent: 40, status: LeadStatus.ENRICHED },
    { company: 'Axiom Loops', domain: 'axiomloops.com', industry: 'dev tools', companySize: '10-50', fundingStage: 'Seed', contactName: 'Nara Lopes', contactTitle: 'Founder', score: 52, buyingIntent: 38, status: LeadStatus.SCORED },
    { company: 'Bright Forecasts', domain: 'brightforecasts.ai', industry: 'SaaS', companySize: '10-50', fundingStage: 'Seed', contactName: 'Isa Marks', contactTitle: 'VP Sales', score: 48, buyingIntent: 34, status: LeadStatus.SCORED },
    { company: 'Rolex Industrials', domain: 'rolex-industrials.com', industry: 'manufacturing', companySize: '1000+', fundingStage: 'Public', score: 36, buyingIntent: 20, status: LeadStatus.DISQUALIFIED, icpFitReason: 'Out of ICP — too large, wrong industry.' },
    { company: 'Tidepool Local', domain: 'tidepoollocal.com', industry: 'consumer', companySize: '10-50', fundingStage: 'Seed', score: 28, buyingIntent: 12, status: LeadStatus.DISQUALIFIED, icpFitReason: 'Consumer. Anti-ICP.' },
    { company: 'Gestalt Bio', domain: 'gestalt.bio', industry: 'biotech', companySize: '200-1000', fundingStage: 'Series C', contactName: 'Ravi Menon', contactTitle: 'VP BD', score: 75, buyingIntent: 62, status: LeadStatus.SCORED },
    { company: 'Terrace Cloud', domain: 'terracecloud.io', industry: 'dev tools', companySize: '50-200', fundingStage: 'Series A', contactName: 'Nina Fox', contactTitle: 'CMO', score: 81, buyingIntent: 70, status: LeadStatus.OUTREACH_READY, icpFitReason: 'Strong ICP fit, hiring outbound team.' },
    { company: 'Cobalt Industries', domain: 'cobaltindustries.co', industry: 'SaaS', companySize: '50-200', fundingStage: 'Series A', contactName: 'Jake Harris', contactTitle: 'CEO', score: 76, buyingIntent: 60, status: LeadStatus.ENRICHED },
    { company: 'Porcupine Data', domain: 'porcupine.io', industry: 'dev tools', companySize: '10-50', fundingStage: 'Seed', status: LeadStatus.NEW },
    { company: 'Undergrowth Finance', domain: 'undergrowth.fi', industry: 'fintech', companySize: '50-200', fundingStage: 'Series A', status: LeadStatus.NEW },
    { company: 'Spindrift Metrics', domain: 'spindrift.ai', industry: 'SaaS', companySize: '10-50', fundingStage: 'Seed', status: LeadStatus.NEW },
  ];

  return templates.map((t) => ({
    ...t,
    product,
    signals: (t.signals as string[] | undefined) ?? [],
  }));
}

function buildDemoSignals(product: Product): Array<Record<string, unknown>> {
  const now = Date.now();
  const dayAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);
  return [
    { product, type: SignalType.HIRING_ORG, source: SignalSource.EXA, description: 'Verge Data posted 4 SDR roles on LinkedIn', company: 'Verge Data', sourceUrl: 'https://linkedin.com/jobs/verge', relevanceScore: 9, detectedAt: dayAgo(1) },
    { product, type: SignalType.FUNDING, source: SignalSource.EXA, description: 'Kite Security raised $18M Series A (Accel lead)', company: 'Kite Security', sourceUrl: 'https://techcrunch.com/kite-18m', relevanceScore: 10, detectedAt: dayAgo(2) },
    { product, type: SignalType.COMPANY_ACTIVITY, source: SignalSource.TAVILY, description: 'Lumen Stack opened Berlin office; hiring EU Sales lead', company: 'Lumen Stack', sourceUrl: 'https://lumenstack.io/blog/eu', relevanceScore: 8, detectedAt: dayAgo(3) },
    { product, type: SignalType.LEADERSHIP_CHANGE, source: SignalSource.EXA, description: 'Halo Route named new CRO from Segment', company: 'Halo Route', sourceUrl: 'https://linkedin.com/halo-cro', relevanceScore: 7, detectedAt: dayAgo(4) },
    { product, type: SignalType.PRODUCT_LAUNCH, source: SignalSource.PERPLEXITY, description: 'Quanta Labs v2 launched with enterprise SSO', company: 'Quanta Labs', sourceUrl: 'https://quanta.ai/v2', relevanceScore: 6, detectedAt: dayAgo(5) },
    { product, type: SignalType.CONTENT_SOCIAL, source: SignalSource.PERPLEXITY, description: 'Fenway founder published viral post on embedded finance', company: 'Fenway Analytics', sourceUrl: 'https://twitter.com/fenwayco/status/x', relevanceScore: 5, detectedAt: dayAgo(6) },
    { product, type: SignalType.HIRING_ORG, source: SignalSource.EXA, description: 'Terrace Cloud listed 7 outbound SDR roles', company: 'Terrace Cloud', sourceUrl: 'https://linkedin.com/terrace', relevanceScore: 9, detectedAt: dayAgo(7) },
    { product, type: SignalType.FUNDING, source: SignalSource.EXA, description: 'Gestalt Bio raised $40M Series C (Andreessen)', company: 'Gestalt Bio', sourceUrl: 'https://techcrunch.com/gestalt-40m', relevanceScore: 6, detectedAt: dayAgo(9) },
    { product, type: SignalType.BUYING_INTENT, source: SignalSource.TAVILY, description: 'Cobalt CEO RFP-reviewing outbound platforms', company: 'Cobalt Industries', sourceUrl: 'https://twitter.com/cobaltceo/x', relevanceScore: 9, detectedAt: dayAgo(10) },
    { product, type: SignalType.REGULATORY, source: SignalSource.MANUAL, description: 'New EU data regs increase GTM compliance cost', sourceUrl: 'https://eur-lex.europa.eu/x', relevanceScore: 4, detectedAt: dayAgo(12) },
    { product, type: SignalType.COMPANY_ACTIVITY, source: SignalSource.EXA, description: 'Parallax Studios acquired small analytics team', company: 'Parallax Studios', sourceUrl: 'https://parallax.io/press/acq', relevanceScore: 7, detectedAt: dayAgo(14) },
    { product, type: SignalType.HIRING_ORG, source: SignalSource.EXA, description: 'Ampersand Security hired VP Sales (ex-Snyk)', company: 'Ampersand Security', sourceUrl: 'https://linkedin.com/amp-vp', relevanceScore: 9, detectedAt: dayAgo(16) },
    { product, type: SignalType.CONTENT_SOCIAL, source: SignalSource.PERPLEXITY, description: 'Merkle Systems exec posted about scaling outbound', company: 'Merkle Systems', sourceUrl: 'https://twitter.com/merklesys/x', relevanceScore: 6, detectedAt: dayAgo(20) },
    { product, type: SignalType.FUNDING, source: SignalSource.EXA, description: 'Sextant Health $12M extension round', company: 'Sextant Health', sourceUrl: 'https://techcrunch.com/sextant', relevanceScore: 5, detectedAt: dayAgo(25) },
    { product, type: SignalType.LEADERSHIP_CHANGE, source: SignalSource.MANUAL, description: 'Obsidian Freight CEO stepped down', company: 'Obsidian Freight', relevanceScore: 3, detectedAt: dayAgo(28) },
  ];
}

function buildDemoFeedback(product: Product): Array<Record<string, unknown>> {
  const now = Date.now();
  const dayAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);
  const agents = [
    AgentType.PROSPECT_DISCOVERY,
    AgentType.ENRICHMENT,
    AgentType.SCORING,
    AgentType.OUTREACH,
    AgentType.SIGNAL_MONITOR,
    AgentType.FEEDBACK,
  ];
  // Trend up: earlier entries 6-7, later entries 8-9.
  return Array.from({ length: 12 }).map((_, i) => {
    const dayOffset = 28 - i * 2;
    const base = 6 + Math.floor(i / 2.5); // 6..10
    const noise = (i % 3) - 1; // -1, 0, +1
    const score = Math.max(4, Math.min(10, base + noise));
    return {
      product,
      agentType: agents[i % agents.length],
      qualityScore: score,
      inputSummary: `Batch ${i + 1} input · ${5 + (i % 3)} leads`,
      outputSummary: `Batch ${i + 1} output · ${score >= 8 ? 'strong ICP coverage' : 'mixed ICP coverage'}`,
      issues: score < 7 ? ['Scoring inconsistent on adjacent industries'] : [],
      suggestions:
        score < 8
          ? ['Tighten industry ICP', 'Weight hiring_org signals higher']
          : ['Maintain current strictness'],
      overallAssessment: score >= 8 ? 'On track' : 'Improving',
      createdAt: dayAgo(dayOffset),
    };
  });
}
