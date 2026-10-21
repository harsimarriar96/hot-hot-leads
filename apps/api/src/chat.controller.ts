import { Body, Controller, Logger, Post } from '@nestjs/common';

import { OrchestratorAgent } from './agents/orchestrator/orchestrator.agent';
import { Auth } from './modules/auth/auth.decorator';
import { RequireFeature, RequirePermission } from './modules/auth/access.decorators';
import { requireOrg, type TenantContext } from './modules/auth/tenant-context';

export interface ChatRequest {
  text: string;
  userId?: string;
}

export interface ChatResponse {
  reply: string;
  elapsedMs: number;
}

@Controller('chat')
@RequireFeature('chat')
@RequirePermission('agents:run')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly orchestrator: OrchestratorAgent) {}

  @Post()
  async chat(@Auth() auth: TenantContext, @Body() body: ChatRequest): Promise<ChatResponse> {
    if (!body?.text) {
      return { reply: 'Please send a non-empty "text" field.', elapsedMs: 0 };
    }
    const ctx = requireOrg(auth);

    const started = Date.now();
    this.logger.log(`Chat: "${body.text.slice(0, 80)}"`);

    const reply = await this.orchestrator.handleMessage(ctx, {
      channel: 'telegram', // placeholder — just used for context string
      userId: ctx.user.id,
      chatId: 'web',
      text: body.text,
      timestamp: new Date(),
    });

    const elapsedMs = Date.now() - started;
    this.logger.log(`Chat reply (${elapsedMs}ms): "${reply.slice(0, 80)}"`);

    return { reply, elapsedMs };
  }
}
