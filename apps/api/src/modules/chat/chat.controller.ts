import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProductsRepository } from '@hothotleads/db';

import { ChatService } from './chat.service';
import { ChatTranscriptService } from './chat-transcript.service';

interface PostMessageBody {
  text: string;
}

@Controller('products/:productId/chat')
export class ProductChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly transcript: ChatTranscriptService,
    private readonly productsRepo: ProductsRepository,
  ) {}

  @Get()
  async get(@Param('productId') productId: string) {
    const product = await this.productsRepo.findById(productId);
    if (!product) return { error: 'Product not found' };
    const chat = await this.transcript.getOrCreateChatForProduct(productId);
    const messages = await this.transcript.listMessages(chat.id);
    return {
      chat: { id: chat.id, createdAt: chat.createdAt, updatedAt: chat.updatedAt },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        contentBlocks: m.contentBlocks,
        sourceChannel: m.sourceChannel,
        sourceRef: m.sourceRef,
        createdAt: m.createdAt,
      })),
    };
  }

  @Post('messages')
  async postMessage(
    @Param('productId') productId: string,
    @Body() body: PostMessageBody,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const heartbeat = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 15_000);

    let clientDisconnected = false;
    res.on('close', () => {
      clientDisconnected = true;
    });

    try {
      for await (const event of this.chatService.handleWebMessage(productId, body.text)) {
        if (!clientDisconnected) {
          send(event.type, event);
        }
        // Always continue the loop so the assistant message is persisted in full
        // even if the client has disconnected.
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!clientDisconnected) {
        send('error', { code: 'run_failed', message });
      }
    } finally {
      clearInterval(heartbeat);
      if (!clientDisconnected) {
        res.end();
      }
    }
  }

  @Delete()
  @HttpCode(204)
  async clearChat(@Param('productId') productId: string): Promise<void> {
    const chat = await this.transcript.getOrCreateChatForProduct(productId);
    await this.transcript.clearMessages(chat.id);
  }
}
