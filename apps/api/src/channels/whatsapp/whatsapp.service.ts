import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHmac } from 'node:crypto';

import { IncomingMessage, OutgoingMessage } from '../../common/types';
import { safeEqual } from '../../modules/auth/auth.service';
import { describeHttpError } from '../http-error';

const GRAPH_API = 'https://graph.facebook.com/v19.0';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly verifyToken: string;
  private readonly appSecret: string;

  constructor(private readonly config: ConfigService) {
    this.phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId') ?? '';
    this.accessToken = this.config.get<string>('whatsapp.accessToken') ?? '';
    this.verifyToken = this.config.get<string>('whatsapp.verifyToken') ?? '';
    this.appSecret = this.config.get<string>('whatsapp.appSecret') ?? '';
  }

  onModuleInit(): void {
    if (this.phoneNumberId && !this.appSecret) {
      this.logger.warn(
        'WHATSAPP_APP_SECRET is not set: inbound WhatsApp webhooks will be rejected until it is configured.',
      );
    }
  }

  async send(message: OutgoingMessage): Promise<void> {
    try {
      await axios.post(
        `${GRAPH_API}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: message.chatId,
          type: 'text',
          text: { body: message.text },
        },
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );
    } catch (err) {
      // Never rethrow the axios error itself: its config carries the bearer token.
      throw new Error(`WhatsApp send failed: ${describeHttpError(err)}`);
    }
    this.logger.log(`Message sent to ${message.chatId}`);
  }

  parseIncoming(payload: Record<string, unknown>): IncomingMessage | null {
    try {
      const entry = (payload.entry as Record<string, unknown>[])?.[0];
      const change = (entry?.changes as Record<string, unknown>[])?.[0];
      const value = change?.value as Record<string, unknown>;
      const msg = (value?.messages as Record<string, unknown>[])?.[0];

      if (!msg || msg.type !== 'text') return null;

      const text = ((msg.text as Record<string, unknown>)?.body as string)?.trim();
      if (!text) return null;

      const waId = msg.from as string;

      return {
        channel: 'whatsapp',
        userId: waId,
        chatId: waId,
        text,
        timestamp: new Date(parseInt(msg.timestamp as string, 10) * 1000),
        rawPayload: payload,
      };
    } catch {
      return null;
    }
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && this.verifyToken && token && safeEqual(token, this.verifyToken)) {
      return challenge;
    }
    return null;
  }

  /**
   * Meta signs every webhook POST: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body).
   * No app secret configured => reject all.
   */
  verifySignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
    if (!this.appSecret || !rawBody || !signatureHeader) return false;
    const expected = `sha256=${createHmac('sha256', this.appSecret).update(rawBody).digest('hex')}`;
    return safeEqual(signatureHeader, expected);
  }
}
