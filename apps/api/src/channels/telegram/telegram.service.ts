import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { safeEqual } from '../../modules/auth/auth.service';
import { describeHttpError } from '../http-error';

import { IncomingMessage, OutgoingMessage } from '../../common/types';

const TELEGRAM_API = 'https://api.telegram.org/bot';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly baseUrl: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const token = this.config.get<string>('telegram.botToken') ?? '';
    this.baseUrl = `${TELEGRAM_API}${token}`;
    this.webhookSecret = this.config.get<string>('telegram.webhookSecret') ?? '';
  }

  onModuleInit(): void {
    if (!this.webhookSecret) {
      this.logger.warn(
        'TELEGRAM_WEBHOOK_SECRET is not set: inbound Telegram webhooks will be rejected until it is configured.',
      );
    }
  }

  async send(message: OutgoingMessage): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: message.chatId,
        text: message.text,
        parse_mode: message.parseMode ?? 'Markdown',
        ...(message.replyToMessageId && { reply_to_message_id: message.replyToMessageId }),
      });
    } catch (err) {
      // Never rethrow the axios error itself: its config.url embeds the bot token.
      throw new Error(`Telegram sendMessage failed: ${describeHttpError(err)}`);
    }
    this.logger.log(`Message sent to chat ${message.chatId}`);
  }

  async sendTyping(chatId: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/sendChatAction`, { chat_id: chatId, action: 'typing' });
    } catch (err) {
      this.logger.warn(`sendChatAction failed: ${describeHttpError(err)}`);
    }
  }

  async registerWebhook(webhookUrl: string): Promise<void> {
    await axios.post(`${this.baseUrl}/setWebhook`, {
      url: webhookUrl,
      ...(this.webhookSecret && { secret_token: this.webhookSecret }),
    });
    this.logger.log(`Webhook registered: ${webhookUrl}`);
  }

  parseIncoming(payload: Record<string, unknown>): IncomingMessage | null {
    const message = (payload.message ?? payload.edited_message) as Record<string, unknown> | undefined;
    if (!message) return null;

    const text = (message.text as string | undefined)?.trim();
    if (!text) return null;

    const from = message.from as Record<string, unknown>;
    const chat = message.chat as Record<string, unknown>;

    return {
      channel: 'telegram',
      userId: String(from?.id ?? ''),
      chatId: String(chat?.id ?? ''),
      text,
      timestamp: new Date((message.date as number) * 1000),
      rawPayload: payload,
    };
  }

  /**
   * Telegram sends the secret configured via setWebhook back verbatim in the
   * X-Telegram-Bot-Api-Secret-Token header. No secret configured => reject all.
   */
  verifySecretToken(headerToken: string | undefined): boolean {
    if (!this.webhookSecret || !headerToken) return false;
    return safeEqual(headerToken, this.webhookSecret);
  }
}
