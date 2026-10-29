import type { ChatResultCard, ChatToolResult } from '@hothotleads/types';
import type { ProductSummary } from '@hothotleads/db';

/**
 * Pure builders that turn rows written during an orchestrator tool call into the
 * `ChatResultCard` the web renders. Every builder returns `undefined` when there is
 * nothing to show, so the tool result carries only the summary in that case.
 */

export const MAX_CARD_ITEMS = 25;
export const PREVIEW_CHARS = 160;

/** Structural row shapes: the MikroORM entities satisfy them, and specs can pass plain objects. */
export interface LeadRow {
  id: string;
  company: string;
  domain?: string | null;
  score?: number | null;
  buyingIntent?: number | null;
  status: string;
  contactName?: string | null;
  contactTitle?: string | null;
  signalSummary?: string | null;
  product: { id: string };
}

export interface SignalRow {
  id: string;
  company?: string | null;
  type: string;
  description: string;
  detectedAt: Date;
  status: string;
  product: { id: string };
}

export interface OutreachRow {
  id: string;
  channel: string;
  subject?: string | null;
  body: string;
  lead: { id: string; company: string; contactName?: string | null; product: { id: string } };
}

export interface FeedbackRow {
  agentType: string;
  qualityScore: number;
  overallAssessment?: string | null;
  issues: string[];
  suggestions: string[];
  product: { id: string };
}

export function toolResult(summary: string, card?: ChatResultCard): ChatToolResult {
  return card ? { summary, card } : { summary };
}

export function buildLeadsCard(productName: string, rows: LeadRow[]): ChatResultCard | undefined {
  if (rows.length === 0) return undefined;
  return {
    kind: 'leads',
    productId: rows[0].product.id,
    productName,
    items: rows.slice(0, MAX_CARD_ITEMS).map((r) => ({
      id: r.id,
      company: r.company,
      domain: r.domain ?? null,
      score: r.score ?? null,
      buyingIntent: r.buyingIntent ?? null,
      status: r.status,
      contactName: r.contactName ?? null,
      contactTitle: r.contactTitle ?? null,
      signalSummary: r.signalSummary ?? null,
    })),
    total: rows.length,
  };
}

export function buildSignalsCard(productName: string, rows: SignalRow[]): ChatResultCard | undefined {
  if (rows.length === 0) return undefined;
  return {
    kind: 'signals',
    productId: rows[0].product.id,
    productName,
    items: rows.slice(0, MAX_CARD_ITEMS).map((r) => ({
      id: r.id,
      company: r.company ?? null,
      type: r.type,
      description: r.description,
      detectedAt: r.detectedAt.toISOString(),
      status: r.status,
    })),
    total: rows.length,
  };
}

export function buildOutreachCard(productName: string, rows: OutreachRow[]): ChatResultCard | undefined {
  if (rows.length === 0) return undefined;
  return {
    kind: 'outreach',
    productId: rows[0].lead.product.id,
    productName,
    items: rows.slice(0, MAX_CARD_ITEMS).map((r) => ({
      id: r.id,
      leadId: r.lead.id,
      company: r.lead.company,
      contactName: r.lead.contactName ?? null,
      channel: r.channel,
      subject: r.subject ?? null,
      preview: preview(r.body),
    })),
    total: rows.length,
  };
}

export function buildFeedbackCard(productName: string, row: FeedbackRow | null | undefined): ChatResultCard | undefined {
  if (!row) return undefined;
  return {
    kind: 'feedback',
    productId: row.product.id,
    productName,
    agentType: row.agentType,
    qualityScore: row.qualityScore,
    overallAssessment: row.overallAssessment ?? null,
    issues: row.issues,
    suggestions: row.suggestions,
  };
}

export function buildProductsCard(products: ProductSummary[]): ChatResultCard | undefined {
  if (products.length === 0) return undefined;
  return { kind: 'products', items: products.map((p) => ({ id: p.id, name: p.productName, slug: p.slug })) };
}

/** First `PREVIEW_CHARS` characters of a draft body, whitespace collapsed to single spaces. */
export function preview(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_CHARS);
}
