import { EntityManager } from '@mikro-orm/postgresql';

import { Lead } from '../entities/lead.entity';
import { OutreachDraft } from '../entities/outreach-draft.entity';
import { Product } from '../entities/product.entity';
import { LeadStatus, OutreachTone } from '../enums';
import { requireProduct } from './products.repository';

export interface SaveLeadInput {
  productName: string;
  company: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  fundingStage?: string;
  location?: string;
  techStack?: string[];
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  linkedinUrl?: string;
  score?: number;
  buyingIntent?: number;
  icpFitReason?: string;
  signalSummary?: string;
  signals?: string[];
  enrichmentData?: Record<string, unknown>;
  status?: LeadStatus | string;
  id?: string;
}

export interface SaveOutreachInput {
  productName: string;
  company: string;
  leadId?: string;
  contactName?: string;
  channel: string;
  subject?: string;
  body: string;
  tone?: string;
}

export interface QueryLeadsInput {
  productName: string;
  company?: string;
  status?: LeadStatus | string;
  minScore?: number;
  limit?: number;
}

export class LeadsRepository {
  constructor(private readonly em: EntityManager) {}

  async saveLead(orgId: string, input: SaveLeadInput): Promise<{ id: string; company: string }> {
    const em = this.em.fork();
    const product = await requireProduct(em, orgId, input.productName);

    let lead: Lead;
    if (input.id) {
      // The id must belong to this product; a foreign id is "not found", never silently updated.
      lead = await em.findOneOrFail(Lead, { id: input.id, product });
    } else if (input.domain) {
      lead =
        (await em.findOne(Lead, { product, domain: input.domain })) ??
        em.create(Lead, { product, company: input.company }, { partial: true });
    } else {
      lead = em.create(Lead, { product, company: input.company }, { partial: true });
    }

    assignLeadFields(lead, input);
    await em.persistAndFlush(lead);
    return { id: lead.id, company: lead.company };
  }

  async queryLeads(orgId: string, input: QueryLeadsInput): Promise<Lead[]> {
    const em = this.em.fork();
    const product = await em.findOne(Product, { organization: orgId, name: input.productName });
    if (!product) return [];

    const where: Record<string, unknown> = { product };
    if (input.status) where.status = input.status as LeadStatus;
    if (input.company) where.company = { $like: `%${input.company}%` };
    if (input.minScore != null) where.score = { $gte: input.minScore };

    return em.find(Lead, where, {
      limit: input.limit ?? 20,
      orderBy: { updatedAt: 'DESC' },
    });
  }

  async saveOutreach(orgId: string, input: SaveOutreachInput): Promise<{ id: string; leadId: string }> {
    const em = this.em.fork();
    const product = await requireProduct(em, orgId, input.productName);

    let lead: Lead | null = null;
    if (input.leadId) {
      lead = await em.findOne(Lead, { id: input.leadId, product });
    } else {
      lead = await em.findOne(Lead, { product, company: input.company });
    }

    if (!lead) {
      lead = em.create(
        Lead,
        { product, company: input.company, status: LeadStatus.OUTREACH_READY },
        { partial: true },
      );
    }

    const draft = em.create(
      OutreachDraft,
      {
        lead,
        channel: input.channel,
        subject: input.subject,
        body: input.body,
        tone: parseTone(input.tone),
      },
      { partial: true },
    );

    await em.persistAndFlush([lead, draft]);
    return { id: draft.id, leadId: lead.id };
  }

  async getLead(orgId: string, id: string): Promise<Lead | null> {
    return this.em
      .fork()
      .findOne(Lead, { id, product: { organization: orgId } }, { populate: ['product', 'outreachDrafts'] });
  }

  /** Leads created in an organization since a point in time (for monthly quotas). */
  async countCreatedSince(orgId: string, since: Date): Promise<number> {
    return this.em.fork().count(Lead, { product: { organization: orgId }, createdAt: { $gte: since } });
  }
}

function assignLeadFields(lead: Lead, input: SaveLeadInput): void {
  if (input.company !== undefined) lead.company = input.company;
  if (input.domain !== undefined) lead.domain = input.domain;
  if (input.industry !== undefined) lead.industry = input.industry;
  if (input.companySize !== undefined) lead.companySize = input.companySize;
  if (input.fundingStage !== undefined) lead.fundingStage = input.fundingStage;
  if (input.location !== undefined) lead.location = input.location;
  if (input.techStack !== undefined) lead.techStack = input.techStack;
  if (input.contactName !== undefined) lead.contactName = input.contactName;
  if (input.contactTitle !== undefined) lead.contactTitle = input.contactTitle;
  if (input.contactEmail !== undefined) lead.contactEmail = input.contactEmail;
  if (input.linkedinUrl !== undefined) lead.linkedinUrl = input.linkedinUrl;
  if (input.score !== undefined) lead.score = input.score;
  if (input.buyingIntent !== undefined) lead.buyingIntent = input.buyingIntent;
  if (input.icpFitReason !== undefined) lead.icpFitReason = input.icpFitReason;
  if (input.signalSummary !== undefined) lead.signalSummary = input.signalSummary;
  if (input.signals !== undefined) lead.signals = input.signals;
  if (input.enrichmentData !== undefined) lead.enrichmentData = input.enrichmentData;
  if (input.status !== undefined) lead.status = input.status as LeadStatus;
}

function parseTone(tone?: string): OutreachTone {
  switch ((tone ?? '').toLowerCase()) {
    case 'formal':
      return OutreachTone.FORMAL;
    case 'casual':
      return OutreachTone.CASUAL;
    default:
      return OutreachTone.FRIENDLY;
  }
}
