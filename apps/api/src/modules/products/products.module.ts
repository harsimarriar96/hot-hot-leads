import { Module } from '@nestjs/common';

import { AgentsModule } from '../../agents/agents.module';
import { DbModule } from '../../db/db.module';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { AuthModule } from '../auth/auth.module';
import { ProductSuggestionsService } from './product-suggestions.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [DbModule, AuthModule, AgentsModule, IntegrationsModule],
  controllers: [ProductsController],
  providers: [ProductSuggestionsService],
})
export class ProductsModule {}
