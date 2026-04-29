## Context

After onboarding, the operator has products in Postgres but no web surface to work with them. Today's only controls are Telegram/WhatsApp slash commands — fine for quick mobile use, wrong for the sustained operator work (tuning ICP, reviewing lead lists, exploring signals) that belongs in the web app.

The user's ask: each product has its own chat. The chat needs to feel like a real thread — history, tool calls, resumable across reloads and days — not a one-shot command box. It should route to the existing `OrchestratorAgent`, reusing the tools and routing logic that already work. And because the operator also uses Telegram/WhatsApp, the web thread should be able to pick up a conversation that started on a channel (and vice versa) when the operator wants that behavior.

## Goals / Non-Goals

**Goals:**
- `/products` list + `/products/:productId` detail, with Overview / Leads / Chat tabs.
- Per-product, persisted, append-only chat with full tool_use/tool_result history.
- SSE streaming for assistant responses and tool events.
- Orchestrator reused as-is for routing and tool execution; it gains only a streaming option.
- Channel handlers (Telegram/WhatsApp) optionally persist their conversations to the same thread so the web UI sees everything.
- Edit ICP / channels / sources / predefined prospects inline on the Overview tab.

**Non-Goals:**
- Multiple ad-hoc chats per product (no "chat 1, chat 2").
- Branching, editing, or deleting individual messages.
- File attachments, voice, images — the current agents don't use them.
- Multi-user collaboration (single operator).
- Real-time presence or typing indicators beyond the trivial "streaming" state.
- Rich-text editor — plain text input only.

## Decisions

### 1. Chat is 1:1 with Product

The simplest model that satisfies the requirement and keeps the UI uncluttered. The `product_chats.product_id` is unique. If the operator wants a fresh conversation they use `DELETE /products/:productId/chat` which clears messages but keeps the chat row.

Alternatives considered: M:N chats-to-products. Overkill and asks the operator to name/manage chat threads; no user value today.

### 2. Append-only messages with JSONB content_blocks

Mirrors Anthropic's `messages` API content shape directly. This means we can feed `history.map(m => ({ role: m.role, content: m.content_blocks }))` straight into the SDK call. No mapping layer, no type drift.

JSONB because tool_use inputs vary wildly by tool and we don't want to schematize per-tool at the DB level. Queries we care about (list messages in order for a chat) don't need to peek inside the JSONB — the `chat_id + created_at` index covers them.

### 3. SSE, not WebSockets

SSE is a perfect fit: one-way server → client streaming, native to HTTP, auto-reconnect, trivial to implement in Nest. WebSockets would add framing, bidirectional concerns, and a new set of edge cases we don't need — the client never needs to push frames mid-run. The cancel flow is client-side only (abort controller closes the connection); the server run is never "cancelled," it just runs to completion and persists.

### 4. Client disconnect does not cancel the run

The orchestrator run represents a unit of work (agent reasoning + tool side effects). Aborting it mid-way could leave Postgres in a partially-written state (a lead saved but not scored, for example). We decouple the stream from the work: the work always runs to completion and persists an assistant message; the stream is the user's live view. On reconnect the user sees the final message via `GET /products/:productId/chat`.

Trade-off: the operator cannot truly "stop" the agent. That's acceptable — runs are bounded by max tool iterations and timeouts already. If we need stop-the-run semantics later, we add a cancellation token threaded through `BaseAgent`.

### 5. Shared ChatTranscriptService between web and channels

The Telegram and WhatsApp controllers currently call the orchestrator directly. We refactor them to:
1. Call `ChatService.handleIncoming({ productId, senderRef, text, sourceChannel })` which:
2. Persists the user message (if `sync_channel_chats`),
3. Calls `OrchestratorAgent.run({ productName, history, userInput })` (non-streaming),
4. Persists the assistant message (if `sync_channel_chats`),
5. Returns the final text for the channel handler to send back to Telegram/WhatsApp.

This gives channels zero user-facing changes while unifying the transcript.

### 6. Overview tab edits are optimistic

Each field edit fires a `PATCH` to the appropriate endpoint (workspace/ICP/channels/sources/predefinedProspects) and updates the cache optimistically. On 4xx/5xx we roll back the local state and surface the error. This avoids waterfall loading spinners for small edits.

### 7. Route guard integrates with onboarding guard

The shell guard decides: onboarding not done → `/onboarding`; onboarding done → if product id in URL and not found → `/products`; otherwise render. No redirect loops because the guard only reads `GET /onboarding` once at mount.

### 8. No message pagination yet

A chat that grows to thousands of messages is not expected in the near-term operator use case. `GET /products/:productId/chat` returns all messages. If we find threads growing unboundedly, add a `?since=<messageId>` query param later.

### 9. Tool_use rendering is opinionated

Tool calls appear as compact disclosures inline with the assistant text, not as a separate debug panel. The operator should always see what the agent did. Expanding a disclosure shows pretty-printed input JSON and the tool result. This makes the agent legible without overwhelming a quick scan.

## Risks / Trade-offs

- **SSE behind proxies / load balancers** → Mitigation: set `X-Accel-Buffering: no` on the SSE response to disable nginx buffering; document this for deploys. Keep-alive heartbeat every 15s so idle intermediaries don't cut the stream.
- **Long runs hit request timeouts** → Mitigation: orchestrator runs typically complete in under 2 minutes; if a deployment environment has a <2min proxy timeout, the stream may disconnect but the run still completes server-side and the message persists. Document the 2–3 min read timeout minimum for proxies.
- **Channel persistence doubles write traffic** → Mitigation: writes are cheap (one row per message), and both channels are low-volume operator-scale traffic.
- **Tool_use inputs contain secrets** → Mitigation: redaction in the persisted JSON at the service level for any tool input field ending in `_token` or `credentials`. The same winston redactor pattern, applied before insert.
- **Accidental delete of chat history** → Mitigation: the `DELETE /products/:productId/chat` endpoint is guarded by a confirmation modal requiring a checkbox acknowledgement; no delete-by-URL.
- **Cross-channel message ordering** → Mitigation: `created_at` is generated DB-side on insert; concurrent inserts get unique monotonic timestamps at millisecond resolution. If collisions appear we switch to a sequence column.
- **Simultaneous runs for the same product** → Mitigation: `ChatService.handleIncoming` acquires an advisory lock on `hashtext('product-chat:' || product_id)` for the duration of a run; a second incoming message waits or is rejected with a "still running" error depending on source channel.

## Migration Plan

1. Add `ProductChat` and `ProductChatMessage` entities + migration in `packages/db`.
2. Add `sync_channel_chats` boolean to `workspaces` in a migration, default `true`.
3. Implement `ChatTranscriptService` (persistence) and `ChatService` (handleIncoming) in `apps/api`.
4. Add a `stream: true` option to `OrchestratorAgent.run` with an async generator returning the event set in the spec.
5. Implement `ChatController` with SSE endpoint.
6. Build web pages: `/products`, `/products/:productId` with three tabs. Start with Overview static, then Leads, then Chat.
7. Build the chat UI component with tool-call disclosures and SSE consumption via `EventSource`.
8. Refactor `TelegramController` and `WhatsAppController` to call `ChatService.handleIncoming`.
9. Wire the overview tab's edit paths to existing settings-style endpoints (some may be extended — e.g., `PUT /products/:id/icp`).
10. Smoke test end-to-end: create product → open chat → "generate 5 leads for fintech" → verify leads written, tool events visible, message persisted.

**Rollback:** revert the PR. New tables are independent; dropping them leaves Telegram/WhatsApp channels working as before if the refactor is also reverted (alternatively, `sync_channel_chats` defaulting off preserves forward compatibility).

## Open Questions

- Do we want per-message feedback (👍/👎) feeding into `feedback_entries`? **Proposed:** add in a follow-up; don't scope-creep this change.
- Should operators be able to pin a message or create a bookmark? **Proposed:** no, not yet.
- For channel messages that don't specify a product (Telegram free-text), do we still persist? **Proposed:** no — persistence requires a known product. Channel messages without a product target continue to use today's behavior.
- Should we expose the raw Anthropic `stop_reason` on message_done? **Proposed:** yes, in a debug disclosure, for troubleshooting.
