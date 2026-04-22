export type LeadStatus =
  | 'new'
  | 'enriched'
  | 'scored'
  | 'outreach_ready'
  | 'contacted'
  | 'qualified'
  | 'disqualified';

export interface Lead {
  id?: string;
  notionPageId?: string;
  productName: string;

  // Company
  company: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  fundingStage?: string;
  location?: string;
  techStack?: string[];

  // Contact
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  linkedinUrl?: string;

  // GTM metadata
  score?: number;           // 0–100
  buyingIntent?: number;    // 0–100 composite buying intent
  icpFitReason?: string;
  signalSummary?: string;
  status: LeadStatus;
  signals: string[];
  enrichmentData?: Record<string, unknown>;

  createdAt?: string;
  updatedAt?: string;
}

export interface OutreachDraft {
  leadId?: string;
  company: string;
  contactName?: string;
  channel: string;
  subject?: string;
  body: string;
  tone: 'formal' | 'casual' | 'friendly';
  generatedAt: string;
  notionPageId?: string;
}

export interface FeedbackEntry {
  id?: string;
  notionPageId?: string;
  productName: string;
  agentType: AgentType;
  inputSummary: string;
  outputSummary: string;
  qualityScore: number;    // 0–10 rated by FeedbackAgent
  issues: string[];
  suggestions: string[];
  createdAt: string;
}

export type AgentType =
  | 'orchestrator'
  | 'product-context'
  | 'prospect-discovery'
  | 'enrichment'
  | 'scoring'
  | 'outreach'
  | 'signal-monitor'
  | 'buying-intent'
  | 'feedback';
