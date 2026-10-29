import { Body, Controller, ForbiddenException, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { ChatSourceChannel } from '@hothotleads/db';

import { ChatService } from '../../modules/chat/chat.service';
import { Public } from '../../modules/auth/public.decorator';
import { TelegramService } from './telegram.service';

@Public()
@Controller('webhooks/telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly chatService: ChatService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ): Promise<void> {
    if (!this.telegram.verifySecretToken(secretToken)) {
      throw new ForbiddenException('Invalid webhook secret');
    }

    const message = this.telegram.parseIncoming(payload);
    if (!message) return;

    // Respond 200 immediately so Telegram doesn't retry; process in the background.
    void this.process(message.userId, message.chatId, message.text);
  }

  private async process(userId: string, chatId: string, text: string): Promise<void> {
    await this.telegram.sendTyping(chatId);
    try {
      const response = await this.chatService.handleIncoming({
        senderRef: userId,
        text,
        sourceChannel: ChatSourceChannel.TELEGRAM,
      });
      await this.telegram.send({ chatId, text: response });
    } catch (err) {
      this.logger.error(`Chat handling failed: ${(err as Error).message}`);
      try {
        await this.telegram.send({
          chatId,
          text: '⚠️ Something went wrong. Please try again.',
          format: 'plain',
        });
      } catch (sendErr) {
        this.logger.error(`Could not deliver error reply: ${(sendErr as Error).message}`);
      }
    }
  }
}
