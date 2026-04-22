export interface Product {
  productName: string;
  notionPageId: string;
}

export interface Lead {
  id?: string;
  company?: string;
  contactName?: string;
  contactTitle?: string;
  industry?: string;
  companySize?: string;
  fundingStage?: string;
  status?: string;
  score?: number | null;
  buyingIntent?: number | null;
  icpFitReason?: string;
}

export interface Signal {
  id?: string;
  company?: string;
  type?: string;
  description?: string;
  sourceUrl?: string;
  detectedAt?: string;
}

export interface Outreach {
  id?: string;
  name?: string;
  company?: string;
  contactName?: string;
  channel?: string;
  subject?: string;
  body?: string;
  tone?: string;
  status?: string;
}

export interface Feedback {
  id?: string;
  name?: string;
  agentType?: string;
  qualityScore?: number | null;
  issues?: string;
  suggestions?: string;
  date?: string;
}

export interface ChatReply {
  reply: string;
  elapsedMs: number;
}

export type PipelineKind = 'leads' | 'signals' | 'outreach' | 'feedback' | 'generic';

export interface PipelineStep {
  id: string;
  label: string;
  description: string;
  /** Expected duration used only for the visual simulation. */
  expectedMs: number;
}

export interface PipelineStepState extends PipelineStep {
  status: 'waiting' | 'running' | 'done' | 'failed';
  startedAt?: number;
  endedAt?: number;
  output?: string;
}
