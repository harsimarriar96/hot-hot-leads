import { Module } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { ProductChatsRepository } from '@hothotleads/db';

import { DbModule } from '../../db/db.module';
import { AgentsModule } from '../../agents/agents.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ChatTranscriptService } from './chat-transcript.service';
import { ChatService } from './chat.service';
import { ProductChatController } from './chat.controller';

@Module({
  imports: [DbModule, AgentsModule, WorkspaceModule],
  providers: [
    {
      provide: ProductChatsRepository,
      useFactory: (em: EntityManager) => new ProductChatsRepository(em),
      inject: [EntityManager],
    },
    ChatTranscriptService,
    ChatService,
  ],
  controllers: [ProductChatController],
  exports: [ChatService, ChatTranscriptService],
})
export class ProductChatModule {}
