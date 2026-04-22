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

import { OrchestratorAgent } from '../../agents/orchestrator/orchestrator.agent';
import { TelegramService } from './telegram.service';

@Controller('webhooks/telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly orchestrator: OrchestratorAgent,
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

    // Send typing indicator immediately
    await this.telegram.sendTyping(message.chatId);

    // Process asynchronously — don't await, respond 200 instantly
    this.orchestrator
      .handleMessage(message)
      .then((response) =>
        this.telegram.send({ chatId: message.chatId, text: response }),
      )
      .catch((err) => {
        console.error('Orchestrator error:', err);
        this.telegram.send({
          chatId: message.chatId,
          text: '⚠️ Something went wrong. Please try again.',
        });
      });
  }
}
