import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ProductsRepository } from '@hothotleads/db';
import type { ChatDetail, ChatSummary } from '@hothotleads/types';

import { Auth } from '../auth/auth.decorator';
import { RequireFeature, RequirePermission } from '../auth/access.decorators';
import { requireOrg, type TenantContext } from '../auth/tenant-context';
import { ChatService } from './chat.service';
import { ChatTranscriptService, toChatMessageView, toChatSummary } from './chat-transcript.service';
import { streamSse } from './sse';

class CreateChatDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

class RenameChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;
}

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  text!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}

@Controller('chats')
@RequireFeature('chat')
export class ChatsController {
  constructor(
    private readonly chatService: ChatService,
    private readonly transcript: ChatTranscriptService,
    private readonly productsRepo: ProductsRepository,
  ) {}

  @Get()
  @RequirePermission('chat:read')
  async list(@Auth() auth: TenantContext, @Query('productId') productId?: string): Promise<ChatSummary[]> {
    const ctx = requireOrg(auth);
    if (productId) {
      const product = await this.productsRepo.findById(ctx.org.id, productId);
      if (!product) throw new NotFoundException('Product not found');
    }
    const chats = await this.transcript.listChats(ctx.org.id, { productId: productId || undefined });
    return chats.map(toChatSummary);
  }

  @Post()
  @RequirePermission('chat:write')
  async create(@Auth() auth: TenantContext, @Body() body: CreateChatDto): Promise<ChatSummary> {
    const ctx = requireOrg(auth);
    if (body.productId) {
      const product = await this.productsRepo.findById(ctx.org.id, body.productId);
      if (!product) throw new NotFoundException('Product not found');
    }
    const created = await this.transcript.createChat(ctx.org.id, {
      productId: body.productId,
      title: body.title,
      createdByUserId: ctx.user.id,
    });
    const chat = (await this.transcript.getChat(ctx.org.id, created.id)) ?? created;
    return toChatSummary(chat);
  }

  /** Starts a new conversation and streams the first turn in one call. */
  @Post('messages')
  @RequirePermission('agents:run')
  async createAndSend(@Auth() auth: TenantContext, @Body() body: SendMessageDto, @Res() res: Response): Promise<void> {
    const ctx = requireOrg(auth);
    await streamSse(
      res,
      this.chatService.handleWebMessage(ctx, { chatId: null, productId: body.productId, text: body.text }),
    );
  }

  @Get(':id')
  @RequirePermission('chat:read')
  async get(@Auth() auth: TenantContext, @Param('id') id: string): Promise<ChatDetail> {
    const ctx = requireOrg(auth);
    const chat = await this.transcript.getChat(ctx.org.id, id);
    if (!chat) throw new NotFoundException('Chat not found');
    const messages = await this.transcript.listMessages(ctx.org.id, chat.id);
    return { chat: toChatSummary(chat), messages: messages.map(toChatMessageView) };
  }

  @Patch(':id')
  @RequirePermission('chat:write')
  async rename(@Auth() auth: TenantContext, @Param('id') id: string, @Body() body: RenameChatDto): Promise<ChatSummary> {
    const ctx = requireOrg(auth);
    const chat = await this.transcript.getChat(ctx.org.id, id);
    if (!chat) throw new NotFoundException('Chat not found');
    return toChatSummary(await this.transcript.renameChat(ctx.org.id, id, body.title));
  }

  @Delete(':id')
  @RequirePermission('chat:write')
  @HttpCode(204)
  async remove(@Auth() auth: TenantContext, @Param('id') id: string): Promise<void> {
    const ctx = requireOrg(auth);
    const chat = await this.transcript.getChat(ctx.org.id, id);
    if (!chat) throw new NotFoundException('Chat not found');
    await this.transcript.removeChat(ctx.org.id, id);
  }

  /** Clears the messages but keeps the conversation. */
  @Delete(':id/messages')
  @RequirePermission('chat:write')
  @HttpCode(204)
  async clear(@Auth() auth: TenantContext, @Param('id') id: string): Promise<void> {
    const ctx = requireOrg(auth);
    const chat = await this.transcript.getChat(ctx.org.id, id);
    if (!chat) throw new NotFoundException('Chat not found');
    await this.transcript.clearMessages(ctx.org.id, id);
  }

  @Post(':id/messages')
  @RequirePermission('agents:run')
  async send(
    @Auth() auth: TenantContext,
    @Param('id') id: string,
    @Body() body: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    const ctx = requireOrg(auth);
    // Resolve before opening the stream so a missing chat is a plain 404, not an SSE error.
    const chat = await this.transcript.getChat(ctx.org.id, id);
    if (!chat) throw new NotFoundException('Chat not found');
    await streamSse(res, this.chatService.handleWebMessage(ctx, { chatId: chat.id, text: body.text }));
  }
}
