import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AgentsModule } from '../agents/agents.module';
import { ChatModule } from '../modules/chat/chat.module';
import { TelegramController } from './telegram/telegram.controller';
import { TelegramService } from './telegram/telegram.service';
import { WhatsAppController } from './whatsapp/whatsapp.controller';
import { WhatsAppService } from './whatsapp/whatsapp.service';

@Module({
  imports: [ConfigModule, AgentsModule, ChatModule],
  controllers: [TelegramController, WhatsAppController],
  providers: [TelegramService, WhatsAppService],
  exports: [TelegramService, WhatsAppService],
})
export class ChannelsModule {}
