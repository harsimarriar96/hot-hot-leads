import { Logger } from '@nestjs/common';
import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';

import { DEFAULT_MODELS } from '../../config/models';
import type { ZodRawShape } from 'zod';
import type { ChatContentBlock, FeatureKey, Permission } from '@hothotleads/types';

import { requireOrg, type OrgContext, type TenantContext } from '../../modules/auth/tenant-context';
import { partitionTools, tenantPreamble } from './tool-access';
import { renderHistory, type HistoryTurn } from './history';

export type { HistoryTurn } from './history';

/**
 * Hard stop for runaway agent loops. One "turn" is one model round-trip; a full
 * lead-generation run uses 10–25. Override per call with AgentRunOptions.maxTurns.
 */
const DEFAULT_MAX_TURNS = 40;

export interface AgentRunOptions {
  /** Who is acting and for which organization. Required: every tool call is scoped by it. */
  ctx: TenantContext;
  model?: string;
  extraContext?: string;
  maxTurns?: number;
  /** Skips model thinking. Short structured replies stay fast: thinking is on by default and can multiply the run time. */
  disableThinking?: boolean;
  /** Prior turns of the conversation this run continues. Rendered into the system overlay. */
  history?: HistoryTurn[];
}

export interface AgentToolDef {
  name: string;
  description: string;
  schema: ZodRawShape;
  /** When set, the tool is hidden from the model unless the org has the feature and the caller the permission. */
  requires?: { feature?: FeatureKey; permission?: Permission };
  handler: (input: Record<string, unknown>, ctx: OrgContext) => Promise<unknown>;
}

export type AssistantContentBlock = ChatContentBlock;

export type AgentEvent =
  | { type: 'message_start'; messageId: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use_start'; toolUseId: string; name: string; input: Record<string, unknown> }
  | {
      type: 'tool_use_result';
      toolUseId: string;
      result: unknown;
      isError: boolean;
    }
  | {
      type: 'message_done';
      messageId: string;
      text: string;
      contentBlocks: AssistantContentBlock[];
    }
  | { type: 'error'; code: string; message: string };

type ExtractedAssistantBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

/**
 * BaseAgent runs a Claude Agent SDK `query()` with an in-process MCP server
 * holding the agent's tools. The SDK spawns the Claude Code CLI as a subprocess,
 * which authenticates with the ANTHROPIC_API_KEY inherited from this process's
 * environment. ANTHROPIC_API_KEY is therefore required in production.
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

  async run(task: string, options: AgentRunOptions): Promise<string> {
    let finalText = '';
    for await (const event of this.runStream(task, options)) {
      if (event.type === 'message_done') finalText = event.text;
    }
    return finalText || 'Task failed.';
  }

  async *runStream(task: string, options: AgentRunOptions): AsyncGenerator<AgentEvent> {
    // The context lives only in this run's closures: agents are singletons shared by every tenant.
    const ctx = requireOrg(options.ctx);
    const { allowed: defs, hidden } = partitionTools(this.buildTools(), ctx);
    const serverName = this.agentName.replace(/[^a-z0-9_]/gi, '_');

    const toolInputsById = new Map<string, { name: string; input: Record<string, unknown> }>();

    const tools = defs.map((d) =>
      tool(d.name, d.description, d.schema, async (args) => {
        this.logger.debug(`[${this.agentName}] tool: ${d.name}`);
        try {
          const result = await d.handler(args as Record<string, unknown>, ctx);
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

    // History goes last so the tenant preamble and the canonical agent prompt stay first.
    const systemPrompt = [
      tenantPreamble(ctx, hidden),
      options.extraContext,
      this.systemPrompt,
      renderHistory(options.history),
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    const model = options.model ?? this.defaultModel();
    this.logger.debug(`[${this.agentName}] starting`, { model, task: task.slice(0, 80) });

    const q = query({
      prompt: task,
      options: {
        systemPrompt,
        model,
        mcpServers: { [serverName]: mcpServer },
        // Only our in-process MCP server: never load MCP servers or settings from the host
        // machine (a developer's personal connectors can carry schemas the API rejects).
        strictMcpConfig: true,
        settingSources: [],
        allowedTools: toolNames,
        tools: [],
        permissionMode: 'bypassPermissions',
        maxTurns: options.maxTurns ?? DEFAULT_MAX_TURNS,
        ...(options.disableThinking ? { thinking: { type: 'disabled' as const } } : {}),
      },
    });

    let finalText = '';
    const finalBlocks: AssistantContentBlock[] = [];
    let emittedStart = false;
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    for await (const msg of q) {
      if (!emittedStart) {
        emittedStart = true;
        yield { type: 'message_start', messageId };
      }

      if (msg.type === 'assistant') {
        const blocks = this.extractBlocks(msg);
        for (const b of blocks) {
          if (b.type === 'text' && b.text) {
            finalText += b.text;
            finalBlocks.push({ type: 'text', text: b.text });
            yield { type: 'text_delta', delta: b.text };
          } else if (b.type === 'tool_use') {
            const name = this.shortToolName(b.name);
            toolInputsById.set(b.id, { name, input: b.input });
            finalBlocks.push({ type: 'tool_use', id: b.id, name, input: b.input });
            yield { type: 'tool_use_start', toolUseId: b.id, name, input: b.input };
          }
        }
      } else if (msg.type === 'user') {
        const toolResults = this.extractToolResults(msg);
        for (const tr of toolResults) {
          const parsed = this.parseToolResultContent(tr.content);
          finalBlocks.push({
            type: 'tool_result',
            tool_use_id: tr.tool_use_id,
            content: parsed,
            is_error: tr.is_error,
          });
          yield {
            type: 'tool_use_result',
            toolUseId: tr.tool_use_id,
            result: parsed,
            isError: Boolean(tr.is_error),
          };
        }
      } else if (msg.type === 'result') {
        if (msg.subtype === 'success') {
          const resultText = msg.result ?? finalText;
          const u = msg.usage;
          // Always logged: this is the per-run cost trail operators grep for.
          this.logger.log(
            `[${this.agentName}] run done: ${msg.num_turns} turns, ${Math.round(msg.duration_ms / 1000)}s, ` +
              `tokens in=${u.input_tokens} out=${u.output_tokens} cache_read=${u.cache_read_input_tokens ?? 0} ` +
              `cache_write=${u.cache_creation_input_tokens ?? 0}, est $${msg.total_cost_usd.toFixed(4)}`,
          );
          if (resultText && !finalText) finalText = resultText;
          yield {
            type: 'message_done',
            messageId,
            text: finalText,
            contentBlocks: finalBlocks,
          };
          return;
        }
        this.logger.error(
          `[${this.agentName}] run ended with ${msg.subtype} after ${msg.num_turns} turns, est $${(msg.total_cost_usd ?? 0).toFixed(4)}`,
        );
        yield {
          type: 'error',
          code: String(msg.subtype ?? 'unknown'),
          message:
            msg.subtype === 'error_max_turns'
              ? `Agent run stopped after ${msg.num_turns} steps (safety limit). Try a narrower request.`
              : `Agent run ended with error (${msg.subtype ?? 'unknown'})`,
        };
        yield {
          type: 'message_done',
          messageId,
          text: finalText || 'Task failed.',
          contentBlocks: finalBlocks,
        };
        return;
      }
    }

    yield {
      type: 'message_done',
      messageId,
      text: finalText,
      contentBlocks: finalBlocks,
    };
  }

  protected defaultModel(): string {
    return process.env.CLAUDE_MODEL ?? DEFAULT_MODELS.default;
  }

  private extractBlocks(msg: unknown): ExtractedAssistantBlock[] {
    const m = msg as { message?: { content?: Array<Record<string, unknown>> } };
    const blocks = m.message?.content ?? [];
    const out: ExtractedAssistantBlock[] = [];
    for (const b of blocks) {
      if (b.type === 'text' && typeof b.text === 'string') {
        out.push({ type: 'text', text: b.text });
      } else if (b.type === 'tool_use' && typeof b.id === 'string') {
        out.push({
          type: 'tool_use',
          id: b.id,
          name: String(b.name ?? 'tool'),
          input: (b.input as Record<string, unknown>) ?? {},
        });
      }
    }
    return out;
  }

  private extractToolResults(msg: unknown): Array<{
    tool_use_id: string;
    content: unknown;
    is_error?: boolean;
  }> {
    const m = msg as { message?: { content?: Array<Record<string, unknown>> } };
    const blocks = m.message?.content ?? [];
    const out: Array<{ tool_use_id: string; content: unknown; is_error?: boolean }> = [];
    for (const b of blocks) {
      if (b.type === 'tool_result' && typeof b.tool_use_id === 'string') {
        out.push({
          tool_use_id: b.tool_use_id as string,
          content: b.content,
          is_error: Boolean(b.is_error),
        });
      }
    }
    return out;
  }

  private parseToolResultContent(raw: unknown): string | Record<string, unknown> {
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) {
      const texts = raw
        .filter((b): b is { type: string; text: string } => (b as { type: string }).type === 'text')
        .map((b) => b.text);
      const joined = texts.join('');
      try {
        const parsed = JSON.parse(joined);
        return parsed as Record<string, unknown>;
      } catch {
        return joined;
      }
    }
    return (raw as Record<string, unknown>) ?? {};
  }

  private shortToolName(fullName: string): string {
    // MCP tools arrive as `mcp__<server>__<tool>` — return just `<tool>` for display.
    const parts = fullName.split('__');
    return parts.length >= 3 ? parts.slice(2).join('__') : fullName;
  }
}
