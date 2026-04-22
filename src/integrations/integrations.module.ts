import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { NotionService } from './notion/notion.service';
import { ProductsRepository } from './notion/repositories/products.repository';
import { LeadsRepository } from './notion/repositories/leads.repository';
import { SignalsRepository } from './notion/repositories/signals.repository';
import { SchedulesRepository } from './notion/repositories/schedules.repository';
import { FeedbackRepository } from './notion/repositories/feedback.repository';
import { ExaService } from './exa/exa.service';
import { TavilyService } from './tavily/tavily.service';
import { PerplexityService } from './perplexity/perplexity.service';

const NOTION_PROVIDERS = [
  NotionService,
  ProductsRepository,
  LeadsRepository,
  SignalsRepository,
  SchedulesRepository,
  FeedbackRepository,
];

const DATA_PROVIDERS = [ExaService, TavilyService, PerplexityService];

@Module({
  imports: [ConfigModule],
  providers: [...NOTION_PROVIDERS, ...DATA_PROVIDERS],
  exports: [...NOTION_PROVIDERS, ...DATA_PROVIDERS],
})
export class IntegrationsModule {}
