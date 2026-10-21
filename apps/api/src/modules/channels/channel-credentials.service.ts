import { BadRequestException, Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import {
  ChannelCredentialsRepository,
  PreferredChannel,
  type RedactedCredential,
} from '@hothotleads/db';

import { CryptoService } from '../../common/crypto/crypto.service';

export interface TelegramCredentials {
  botToken: string;
  webhookSecret?: string;
}

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
}

export type ChannelCredentialPayload =
  | { channel: PreferredChannel.TELEGRAM; credentials: TelegramCredentials }
  | { channel: PreferredChannel.WHATSAPP; credentials: WhatsAppCredentials };

@Injectable()
export class ChannelCredentialsService {
  constructor(
    private readonly repo: ChannelCredentialsRepository,
    private readonly crypto: CryptoService,
  ) {}

  async save(orgId: string, payload: ChannelCredentialPayload): Promise<void> {
    await this.validate(payload);
    const plaintext = JSON.stringify(payload.credentials);
    const blob = this.crypto.encrypt(plaintext);
    await this.repo.save(orgId, payload.channel, blob);
  }

  async load(orgId: string, channel: PreferredChannel.TELEGRAM): Promise<TelegramCredentials | null>;
  async load(orgId: string, channel: PreferredChannel.WHATSAPP): Promise<WhatsAppCredentials | null>;
  async load(
    orgId: string,
    channel: PreferredChannel,
  ): Promise<TelegramCredentials | WhatsAppCredentials | null> {
    const blob = await this.repo.load(orgId, channel);
    if (!blob) return null;
    const plaintext = this.crypto.decrypt(blob);
    return JSON.parse(plaintext);
  }

  async list(orgId: string): Promise<RedactedCredential[]> {
    return this.repo.list(orgId);
  }

  async remove(orgId: string, channel: PreferredChannel): Promise<void> {
    await this.repo.remove(orgId, channel);
  }

  private async validate(payload: ChannelCredentialPayload): Promise<void> {
    if (payload.channel === PreferredChannel.TELEGRAM) {
      await this.validateTelegram(payload.credentials);
    } else {
      this.validateWhatsApp(payload.credentials);
    }
  }

  private async validateTelegram(creds: TelegramCredentials): Promise<void> {
    if (!creds.botToken || !creds.botToken.trim()) {
      throw new BadRequestException('Telegram botToken is required');
    }
    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${creds.botToken}/getMe`,
        { timeout: 5000 },
      );
      if (!response.data?.ok) {
        throw new BadRequestException('Telegram getMe returned not-ok — check bot token');
      }
    } catch (err) {
      const axErr = err as AxiosError;
      throw new BadRequestException(
        `Telegram credentials rejected: ${axErr.message ?? 'unknown error'}`,
      );
    }
  }

  private validateWhatsApp(creds: WhatsAppCredentials): void {
    if (!creds.phoneNumberId?.trim()) {
      throw new BadRequestException('WhatsApp phoneNumberId is required');
    }
    if (!creds.accessToken?.trim()) {
      throw new BadRequestException('WhatsApp accessToken is required');
    }
    if (!creds.verifyToken?.trim()) {
      throw new BadRequestException('WhatsApp verifyToken is required');
    }
  }
}
