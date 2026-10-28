export interface Product {
  id: string;
  name: string;
  slug: string;
}

export interface Lead {
  id?: string;
  company?: string;
  domain?: string | null;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string | null;
  linkedinUrl?: string | null;
  industry?: string;
  companySize?: string;
  fundingStage?: string;
  location?: string | null;
  techStack?: string[] | null;
  status?: string;
  score?: number | null;
  buyingIntent?: number | null;
  icpFitReason?: string;
  signalSummary?: string | null;
  signals?: string[];
  enrichmentData?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Signal {
  id?: string;
  company?: string;
  type?: string;
  description?: string;
  sourceUrl?: string;
  detectedAt?: string;
  status?: string;
  relevanceScore?: number | null;
  snoozedUntil?: string | null;
  reviewedAt?: string | null;
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
  agentType?: string;
  qualityScore?: number | null;
  inputSummary?: string;
  outputSummary?: string;
  issues?: string[];
  suggestions?: string[];
  overallAssessment?: string;
  createdAt?: string;
}
