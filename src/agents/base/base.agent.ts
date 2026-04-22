import { Logger } from '@nestjs/common';
import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import type { ZodRawShape } from 'zod';

export interface AgentRunOptions {
  model?: string;
  extraContext?: string;
  maxTurns?: number;
}

export interface AgentToolDef {
  name: string;
  description: string;
  schema: ZodRawShape;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

/**
 * BaseAgent runs a Claude Agent SDK `query()` with an in-process MCP server
 * holding the agent's tools. Auth is via the user's Claude Code subscription —
 * no ANTHROPIC_API_KEY needed.
 *
 * Each subclass provides: systemPrompt, agentName, buildTools().
 */
export abstract class BaseAgent {
  protected abstract readonly systemPrompt: string;
  protected abstract readonly agentName: string;
  protected abstract buildTools(): AgentToolDef[];

  protected readonly logger: Logger;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  async run(task: string, options: AgentRunOptions = {}): Promise<string> {
    const defs = this.buildTools();
    const serverName = this.agentName.replace(/[^a-z0-9_]/gi, '_');

    const tools = defs.map((d) =>
      tool(d.name, d.description, d.schema, async (args) => {
        this.logger.debug(`[${this.agentName}] tool: ${d.name}`, args as Record<string, unknown>);
        try {
          const result = await d.handler(args as Record<string, unknown>);
          return {
            content: [{ type: 'text', text: JSON.stringify(result ?? null) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`[${this.agentName}] tool error: ${d.name}`, message);
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
            isError: true,
          };
        }
      }),
    );

    const mcpServer = createSdkMcpServer({ name: serverName, version: '1.0.0', tools });
    const toolNames = defs.map((d) => `mcp__${serverName}__${d.name}`);

    const systemPrompt = options.extraContext
      ? `${options.extraContext}\n\n---\n\n${this.systemPrompt}`
      : this.systemPrompt;

    const model = options.model ?? this.defaultModel();
    this.logger.debug(`[${this.agentName}] starting`, { model, task: task.slice(0, 80) });

    const q = query({
      prompt: task,
      options: {
        systemPrompt,
        model,
        mcpServers: { [serverName]: mcpServer },
        allowedTools: toolNames,
        tools: [],
        permissionMode: 'bypassPermissions',
      },
    });

    let lastText = '';
    for await (const msg of q) {
      if (msg.type === 'assistant') {
        const text = this.extractAssistantText(msg);
        if (text) lastText = text;
      } else if (msg.type === 'result') {
        if (msg.subtype === 'success') {
          this.logger.debug(`[${this.agentName}] done (${msg.num_turns} turns, $${msg.total_cost_usd.toFixed(4)})`);
          return msg.result;
        }
        this.logger.error(`[${this.agentName}] result error`, {
          subtype: msg.subtype,
          is_error: msg.is_error,
        });
        return lastText || 'Task failed.';
      }
    }
    return lastText;
  }

  protected defaultModel(): string {
    return process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5';
  }

  private extractAssistantText(msg: unknown): string {
    const m = msg as { message?: { content?: Array<{ type: string; text?: string }> } };
    const blocks = m.message?.content ?? [];
    return blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
  }
}
