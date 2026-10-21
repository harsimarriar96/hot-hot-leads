import { Module } from '@nestjs/common';

import { DbModule } from '../../db/db.module';
import { AgentsModule } from '../../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { ChatTranscriptService } from './chat-transcript.service';
import { ChatService } from './chat.service';
import { ProductChatController } from './chat.controller';

@Module({
  imports: [DbModule, AgentsModule, AuthModule],
  providers: [ChatTranscriptService, ChatService],
  controllers: [ProductChatController],
  exports: [ChatService, ChatTranscriptService],
})
export class ProductChatModule {}
