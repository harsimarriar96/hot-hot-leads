import { Body, Controller, Logger, Post } from '@nestjs/common';

import { OrchestratorAgent } from './agents/orchestrator/orchestrator.agent';

export interface ChatRequest {
  text: string;
  userId?: string;
}

export interface ChatResponse {
  reply: string;
  elapsedMs: number;
}

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly orchestrator: OrchestratorAgent) {}

  @Post()
  async chat(@Body() body: ChatRequest): Promise<ChatResponse> {
    if (!body?.text) {
      return { reply: 'Please send a non-empty "text" field.', elapsedMs: 0 };
    }

    const started = Date.now();
    this.logger.log(`Chat: "${body.text.slice(0, 80)}"`);

    const reply = await this.orchestrator.handleMessage({
      channel: 'telegram', // placeholder — just used for context string
      userId: body.userId ?? 'local-tester',
      chatId: body.userId ?? 'local-tester',
      text: body.text,
      timestamp: new Date(),
    });

    const elapsedMs = Date.now() - started;
    this.logger.log(`Chat reply (${elapsedMs}ms): "${reply.slice(0, 80)}"`);

    return { reply, elapsedMs };
  }
}
