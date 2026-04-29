import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ChatSourceChannel } from '@hothotleads/db';

import { ChatService } from '../../modules/chat/chat.service';
import { TelegramService } from './telegram.service';

@Controller('webhooks/telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly chatService: ChatService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
  ): Promise<void> {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));
    if (!this.telegram.verifySignature(rawBody, secretToken ?? '')) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const message = this.telegram.parseIncoming(payload);
    if (!message) return;

    await this.telegram.sendTyping(message.chatId);

    // Process asynchronously — don't await, respond 200 instantly so Telegram doesn't retry.
    this.chatService
      .handleIncoming({
        senderRef: message.userId,
        text: message.text,
        sourceChannel: ChatSourceChannel.TELEGRAM,
      })
      .then((response) => this.telegram.send({ chatId: message.chatId, text: response }))
      .catch((err) => {
        console.error('Chat service error:', err);
        this.telegram.send({
          chatId: message.chatId,
          text: '⚠️ Something went wrong. Please try again.',
        });
      });
  }
}
