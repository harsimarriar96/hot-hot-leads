export type ChannelType = 'telegram' | 'whatsapp';

export interface IncomingMessage {
  channel: ChannelType;
  userId: string;
  chatId: string;
  text: string;
  timestamp: Date;
  rawPayload?: Record<string, unknown>;
}

export interface OutgoingMessage {
  chatId: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  replyToMessageId?: string;
}

export type LeadStatus =
  | 'new'
  | 'enriched'
  | 'scored'
  | 'outreach_ready'
  | 'contacted'
  | 'qualified'
  | 'disqualified';

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

export type SignalType =
  | 'content_social'
  | 'hiring_org'
  | 'company_activity'
  | 'regulatory'
  | 'buying_intent'
  | 'funding'
  | 'hiring'
  | 'news'
  | 'product_launch'
  | 'leadership_change';

export type SignalSourceName = 'exa' | 'tavily' | 'perplexity' | 'manual';

export type OutreachToneName = 'formal' | 'casual' | 'friendly';

export type SourceTypeName = 'news' | 'newsletter' | 'database' | 'social' | 'other';

export type ScheduleFrequencyName = 'hourly' | 'daily' | 'weekly' | 'custom';

export interface Lead {
  id: string;
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
  status: LeadStatus;
  signals: string[];
  enrichmentData?: Record<string, unknown>;

  createdAt?: string;
  updatedAt?: string;
}

export interface OutreachDraft {
  id: string;
  leadId?: string;
  company: string;
  contactName?: string;
  channel: string;
  subject?: string;
  body: string;
  tone: OutreachToneName;
  generatedAt: string;
}

export interface FeedbackEntry {
  id: string;
  productName: string;
  agentType: AgentType;
  inputSummary: string;
  outputSummary: string;
  qualityScore: number;
  issues: string[];
  suggestions: string[];
  overallAssessment?: string;
  createdAt: string;
}

export interface SignalRecord {
  id?: string;
  type: SignalType;
  source?: SignalSourceName;
  description: string;
  company?: string;
  sourceUrl?: string;
  relevanceScore?: number;
  detectedAt: string;
  expiresAt?: string;
}

export interface PredefinedProspect {
  id?: string;
  company: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  fundingStage?: string;
  icpFitNotes?: string;
}

export interface SalesChannel {
  id?: string;
  name: string;
  description: string;
  template?: string;
}

export interface SourceRecord {
  id?: string;
  name: string;
  url?: string;
  description?: string;
  type: SourceTypeName;
}

export interface ProductOutputIds {
  generatedLeadsDatabaseId: string;
  outreachQueueDatabaseId: string;
  feedbackLogDatabaseId: string;
}

export interface ProductKnowledge {
  id: string;
  productName: string;
  generalInfo: string;
  predefinedProspects: PredefinedProspect[];
  signals: SignalRecord[];
  salesStrategy: string;
  salesChannels: SalesChannel[];
  pricing: string;
  sources: SourceRecord[];
  output: ProductOutputIds;
}

export interface ProductSummary {
  id: string;
  productName: string;
  slug?: string;
}

export interface Schedule {
  id: string;
  name: string;
  productName?: string;
  taskPrompt: string;
  frequency: ScheduleFrequencyName;
  cronExpression?: string;
  userId: string;
  chatId: string;
  channel: ChannelType;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

// Explicit re-exports: the bundler must see the runtime values (ROLES, DEFAULT_ENTITLEMENTS, ...)
// as named CommonJS exports, which `export *` hides behind __exportStar.
export {
  ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
  FEATURE_KEYS,
  CHANNEL_KEYS,
  DEFAULT_ENTITLEMENTS,
  resolveEntitlements,
} from './auth';
export type {
  Role,
  Permission,
  FeatureKey,
  ChannelKey,
  EntitlementLimits,
  Entitlements,
  EntitlementsPatch,
  AuthUser,
  OrganizationSummary,
  ActiveOrganization,
  AuthMeResponse,
  LoginResponse,
  DenialCode,
  DenialBody,
  Member,
  Invitation,
  OrganizationView,
  PlatformOrganization,
  PlatformUser,
} from './auth';
export type {
  ChatContentBlock,
  ChatRoleName,
  ChatSourceChannelName,
  ChatSummary,
  ChatMessageView,
  ChatDetail,
  CreateChatBody,
  SendMessageBody,
  ChatSseEvent,
} from './chat';
