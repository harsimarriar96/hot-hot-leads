import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ExaService } from './exa/exa.service';
import { TavilyService } from './tavily/tavily.service';
import { PerplexityService } from './perplexity/perplexity.service';

const DATA_PROVIDERS = [ExaService, TavilyService, PerplexityService];

@Module({
  imports: [ConfigModule],
  providers: [...DATA_PROVIDERS],
  exports: [...DATA_PROVIDERS],
})
export class IntegrationsModule {}
