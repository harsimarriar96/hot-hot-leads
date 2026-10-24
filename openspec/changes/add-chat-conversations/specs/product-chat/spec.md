## REMOVED Requirements

### Requirement: One chat thread per product
**Reason**: Replaced by organization-scoped conversations (`chat-conversations`); a product may have many.
**Migration**: `product_chats` is renamed to `chats` in place; the existing row becomes the product's first conversation.

### Requirement: Chat API contract
**Reason**: `GET/POST/DELETE /products/:productId/chat` are replaced by `/api/chats` (see `chat-conversations`).
**Migration**: The web client is updated in the same change; no other HTTP consumer exists.

## MODIFIED Requirements

### Requirement: Append-only message log

The `chat_messages` table MUST have: `id` (uuid, pk), `chat_id` (uuid, fk → chats.id), `role` (enum: user | assistant | tool), `content_blocks` (jsonb, not null), `source_channel` (enum: web | telegram | whatsapp, default `'web'`), `source_ref` (text, nullable), `created_at`. The table MUST have an index on `(chat_id, created_at ASC)`.

`content_blocks` SHALL mirror the Anthropic messages-API content array (`text`, `tool_use`, `tool_result`). Messages MUST NOT be updated in place; corrections are appended.

#### Scenario: Messages load in order
- **WHEN** `GET /api/chats/:id` is called
- **THEN** messages are returned sorted by `created_at ASC` with no gaps and no duplicates

### Requirement: Orchestrator streaming mode

`BaseAgent.runStream(task, options)` SHALL return an `AsyncGenerator<AgentEvent>`; `run()` drains it. `options` MUST accept `extraContext?`, `model?`, `maxTurns?` and `history?: Array<{ role: 'user' | 'assistant'; text: string }>`. History is rendered into the system overlay after the canonical system prompt, which MUST NOT be replaced.

`ChatService.handleWebMessage` MUST construct `extraContext` and `model` per turn from the linked product's `agent_extra_instructions`, `icp_strictness` and `agent_model_tier` when the conversation has a product, and use a plain web context and the default model otherwise. Channel runs MUST NOT consult the product overrides but DO receive the conversation history.

#### Scenario: Non-streaming callers unaffected
- **WHEN** a Telegram handler calls `chatService.handleIncoming(...)`
- **THEN** the return value is a single string equal to the assistant's final reply

#### Scenario: Per-product overrides flow through web runs
- **WHEN** a web turn runs in a conversation linked to a product with `agent_model_tier = 'heavy'` and non-empty `agent_extra_instructions`
- **THEN** the orchestrator receives `options.model` resolved from `CLAUDE_MODEL_HEAVY` and `options.extraContext` containing the base context line and the verbatim instructions

### Requirement: Channel conversations persist to the same thread

When `organizations.sync_channel_chats = true` (default), incoming Telegram/WhatsApp messages for a product MUST persist to the product conversation selected by the routing rule in `chat-conversations` (channel-bearing conversation, else newest, else new), with `source_channel` set and the sender reference in `source_ref`. When the flag is false, channel conversations MUST NOT write to `chat_messages`.

#### Scenario: Telegram message appears in the product's conversation
- **WHEN** `sync_channel_chats = true` and a Telegram message is processed for product X
- **THEN** the product Chat tab shows the user message with a `telegram` badge and the assistant response in the routed conversation

### Requirement: Chat UI

The `/products/:productId` Chat tab SHALL render the product's conversation list beside the selected conversation. Messages render user right-aligned, assistant left-aligned, with `tool_use` + `tool_result` collapsed into a disclosure (lucide `Wrench`, tool name, expandable input and result). Text deltas MUST render incrementally, coalesced per animation frame. The live pipeline strip renders above the thread in fixed vertical space.

The composer MUST support multi-line input (Enter to send, Shift+Enter for newline). "Clear" (Dialog-confirmed, `chat:write`) removes the selected conversation's messages via `DELETE /api/chats/:id/messages` after a 5-second Undo window that restores the in-memory snapshot.

#### Scenario: Undo restores cleared messages
- **WHEN** the operator clears the conversation and clicks "Undo" within 5 seconds
- **THEN** the messages reappear locally and no `DELETE` API call is fired
