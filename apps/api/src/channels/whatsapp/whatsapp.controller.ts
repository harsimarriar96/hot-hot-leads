import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';

import { ChatSourceChannel } from '@hothotleads/db';

import { ChatService } from '../../modules/chat/chat.service';
import { WhatsAppService } from './whatsapp.service';

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly chatService: ChatService,
  ) {}

  /** Meta verification handshake */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const result = this.whatsapp.verifyWebhook(mode, token, challenge);
    if (!result) {
      throw new ForbiddenException('Webhook verification failed');
    }
    res.status(200).send(result);
  }

  @Post()
  @HttpCode(200)
  async handleWebhook(@Body() payload: Record<string, unknown>): Promise<void> {
    const message = this.whatsapp.parseIncoming(payload);
    if (!message) return;

    this.chatService
      .handleIncoming({
        senderRef: message.userId,
        text: message.text,
        sourceChannel: ChatSourceChannel.WHATSAPP,
      })
      .then((response) => this.whatsapp.send({ chatId: message.chatId, text: response }))
      .catch((err) => {
        console.error('Chat service error:', err);
        this.whatsapp.send({
          chatId: message.chatId,
          text: '⚠️ Something went wrong. Please try again.',
        });
      });
  }
}
