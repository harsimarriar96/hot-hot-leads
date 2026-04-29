import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { IncomingMessage, OutgoingMessage } from '../../common/types';

const GRAPH_API = 'https://graph.facebook.com/v19.0';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly verifyToken: string;

  constructor(private readonly config: ConfigService) {
    this.phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId') ?? '';
    this.accessToken = this.config.get<string>('whatsapp.accessToken') ?? '';
    this.verifyToken = this.config.get<string>('whatsapp.verifyToken') ?? '';
  }

  async send(message: OutgoingMessage): Promise<void> {
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
    if (mode === 'subscribe' && token === this.verifyToken) {
      return challenge;
    }
    return null;
  }
}
