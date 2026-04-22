/**
 * Mirrors the Notion workspace structure:
 *
 *   Knowledge/
 *     └── [Product]/
 *           ├── General Information   (page → string)
 *           ├── Predefined Prospects  (database → ProspectRecord[])
 *           ├── Signals               (database → SignalRecord[])
 *           ├── Sales Strategy        (page → string)
 *           ├── Sales Channels        (page → SalesChannel[])
 *           ├── Pricing               (page → string)
 *           └── Sources               (page/database → SourceRecord[])
 *
 *   Output/
 *     └── [Product]/
 *           ├── Generated Leads       (database)
 *           ├── Outreach Queue        (database)
 *           └── Feedback Log          (database)
 */

export interface ProductKnowledge {
  productName: string;
  notionPageId: string;

  // Knowledge sections
  generalInfo: string;
  predefinedProspects: PredefinedProspect[];
  signals: SignalRecord[];
  salesStrategy: string;
  salesChannels: SalesChannel[];
  pricing: string;
  sources: SourceRecord[];

  // Output database IDs (for writing results)
  output: ProductOutputIds;
}

export interface ProductOutputIds {
  generatedLeadsDatabaseId: string;
  outreachQueueDatabaseId: string;
  feedbackLogDatabaseId: string;
}

export interface PredefinedProspect {
  company: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  fundingStage?: string;
  icpFitNotes?: string;
  notionPageId?: string;
}

export type SignalType =
  | 'content_social'
  | 'hiring_org'
  | 'company_activity'
  | 'regulatory'
  | 'buying_intent'
  // Legacy types (still supported)
  | 'funding'
  | 'hiring'
  | 'news'
  | 'product_launch'
  | 'leadership_change';

export type SignalSource = 'exa' | 'tavily' | 'perplexity' | 'manual';

export interface SignalRecord {
  type: SignalType;
  source?: SignalSource;
  description: string;
  company?: string;
  sourceUrl?: string;
  relevanceScore?: number; // 0–10
  detectedAt: string;
  expiresAt?: string;
  notionPageId?: string;
}

export interface SalesChannel {
  name: string; // e.g. "LinkedIn DM", "Cold Email", "Partner Referral"
  description: string;
  template?: string;
}

export interface SourceRecord {
  name: string;
  url?: string;
  description?: string;
  type: 'news' | 'newsletter' | 'database' | 'social' | 'other';
}

export interface ProductSummary {
  productName: string;
  notionPageId: string;
}
