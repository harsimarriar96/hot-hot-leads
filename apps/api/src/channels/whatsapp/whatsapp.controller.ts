import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatSourceChannel } from '@hothotleads/db';

import { ChatService } from '../../modules/chat/chat.service';
import { Public } from '../../modules/auth/public.decorator';
import { WhatsAppService } from './whatsapp.service';

@Public()
@Controller('webhooks/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

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
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
    @Headers('x-hub-signature-256') signature?: string,
  ): Promise<void> {
    if (!this.whatsapp.verifySignature(req.rawBody, signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const message = this.whatsapp.parseIncoming(payload);
    if (!message) return;

    void this.process(message.userId, message.chatId, message.text);
  }

  private async process(userId: string, chatId: string, text: string): Promise<void> {
    try {
      const response = await this.chatService.handleIncoming({
        senderRef: userId,
        text,
        sourceChannel: ChatSourceChannel.WHATSAPP,
      });
      await this.whatsapp.send({ chatId, text: response });
    } catch (err) {
      this.logger.error(`Chat handling failed: ${(err as Error).message}`);
      try {
        await this.whatsapp.send({ chatId, text: '⚠️ Something went wrong. Please try again.' });
      } catch (sendErr) {
        this.logger.error(`Could not deliver error reply: ${(sendErr as Error).message}`);
      }
    }
  }
}
