import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { IntegrationsModule } from '../integrations/integrations.module';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../modules/auth/auth.module';
import { OrchestratorAgent } from './orchestrator/orchestrator.agent';
import { ProductContextAgent } from './product-context/product-context.agent';
import { ProspectDiscoveryAgent } from './prospect-discovery/prospect-discovery.agent';
import { EnrichmentAgent } from './enrichment/enrichment.agent';
import { ScoringAgent } from './scoring/scoring.agent';
import { OutreachAgent } from './outreach/outreach.agent';
import { SignalMonitorAgent } from './signal-monitor/signal-monitor.agent';
import { BuyingIntentAgent } from './buying-intent/buying-intent.agent';
import { FeedbackAgent } from './feedback/feedback.agent';
import { ProductSuggestionAgent } from './product-suggestion/product-suggestion.agent';

const AGENTS = [
  OrchestratorAgent,
  ProductContextAgent,
  ProspectDiscoveryAgent,
  EnrichmentAgent,
  ScoringAgent,
  OutreachAgent,
  SignalMonitorAgent,
  BuyingIntentAgent,
  FeedbackAgent,
  ProductSuggestionAgent,
];

@Module({
  imports: [ConfigModule, IntegrationsModule, DbModule, AuthModule],
  providers: AGENTS,
  exports: AGENTS,
})
export class AgentsModule {}
