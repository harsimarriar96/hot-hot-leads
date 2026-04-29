# product-chat

## Purpose

A persistent, per-product chat thread that routes user input to the multi-agent orchestrator, streams the response (text and tool calls) over Server-Sent Events, and persists the final exchange as Anthropic-shaped content blocks. Telegram and WhatsApp channels share the same thread when `workspaces.sync_channel_chats = true`.
## Requirements
### Requirement: One chat thread per product

Each `Product` SHALL have exactly one `ProductChat` row. The `product_chats` table MUST have: `id` (uuid, pk), `product_id` (uuid, fk → products.id, unique, not null), `created_at`, `updated_at`. The chat row MAY be created lazily on first message OR eagerly with the product — implementation choice — but the "one chat per product" invariant MUST hold.

#### Scenario: Second chat for same product is rejected
- **WHEN** an insert is attempted with a `product_id` that already has a `product_chats` row
- **THEN** the insert fails with a unique-violation error

#### Scenario: First message creates the chat if absent
- **WHEN** a user posts a message to a product that has no chat row
- **THEN** the API creates the `product_chats` row and the `product_chat_messages` row in one transaction

### Requirement: Append-only message log

The `product_chat_messages` table MUST have: `id` (uuid, pk), `chat_id` (uuid, fk), `role` (enum: user | assistant | tool), `content_blocks` (jsonb, not null), `source_channel` (enum: web | telegram | whatsapp, default `'web'`), `source_ref` (text, nullable), `created_at`. The table MUST have an index on `(chat_id, created_at ASC)`.

`content_blocks` SHALL mirror the Anthropic messages-API content array:
- `{ "type": "text", "text": string }`
- `{ "type": "tool_use", "id": string, "name": string, "input": object }`
- `{ "type": "tool_result", "tool_use_id": string, "content": string | object, "is_error": boolean }`

Messages MUST NOT be updated in place. Corrections are achieved by appending new messages.

#### Scenario: Messages load in order
- **WHEN** `GET /products/:productId/chat` is called
- **THEN** messages are returned sorted by `created_at ASC` with no gaps and no duplicates

### Requirement: Chat API contract

The API SHALL expose:
- `GET /products/:productId/chat` → returns `{ chat, messages }`.
- `POST /products/:productId/chat/messages` → body `{ text: string }`. Response is a Server-Sent Events stream with these named events: `message_start`, `text_delta`, `tool_use_start`, `tool_use_result`, `message_done`, `error`.
- `DELETE /products/:productId/chat` → clears messages (preserves the chat row).

The `POST` endpoint MUST persist the user message before streaming starts. If the client disconnects mid-stream, the server MUST continue the orchestrator run to completion and persist the resulting assistant message in full.

#### Scenario: Client disconnects mid-stream
- **WHEN** the client closes the SSE connection after a `tool_use_start` but before `message_done`
- **THEN** the orchestrator run continues on the server, and the final assistant message is persisted in full

#### Scenario: Error mid-run persists what happened
- **WHEN** a tool call throws and the orchestrator halts
- **THEN** an assistant message is persisted including prior text + tool_use + tool_result(is_error=true) blocks, and an `error` SSE event is sent to the client

### Requirement: Orchestrator streaming mode

`BaseAgent.runStream(task, options)` SHALL return an `AsyncGenerator<AgentEvent>`. The non-streaming `run()` is a thin wrapper that drains the generator. Both signatures MUST coexist so non-web callers (Telegram, WhatsApp, scheduler) keep working without changes.

`runStream` MUST accept an `options` object that includes:
- `extraContext?: string` — appended to the system overlay; the canonical system prompt MUST NOT be replaced.
- `model?: string` — overrides the default Claude model id for the duration of this run.

`ChatService.handleWebMessage` MUST construct `extraContext` and `model` per turn from the parent product's `agent_extra_instructions`, `icp_strictness`, and `agent_model_tier` fields (see capability `agent-customization`). `ChatService.handleIncoming` (channel entry) MUST NOT consult these fields in v1 — channel runs use the default model and a minimal channel-tagged context.

#### Scenario: Non-streaming callers unaffected
- **WHEN** an existing Telegram handler calls `chatService.handleIncoming(...)` which uses `OrchestratorAgent.run(...)` non-streaming
- **THEN** the return value is a single string equal to the assistant's final reply

#### Scenario: Streamed tool events match persistence
- **WHEN** the orchestrator executes two tools during a run
- **THEN** the SSE stream emits two `tool_use_start` / `tool_use_result` pairs, and the persisted `content_blocks` array contains the same two `tool_use` + `tool_result` blocks in order

#### Scenario: Per-product overrides flow through web runs
- **WHEN** a web chat turn runs for a product with `agent_model_tier = 'heavy'` and non-empty `agent_extra_instructions`
- **THEN** the orchestrator receives `options.model` resolved from `CLAUDE_MODEL_HEAVY` and `options.extraContext` containing both the base context line and the verbatim instructions

#### Scenario: Channel runs ignore overrides
- **WHEN** a Telegram message routes to the same product
- **THEN** the orchestrator runs with the default model and no extra-instructions overlay (channel boundary preserved)

### Requirement: Channel conversations persist to the same thread

When `workspaces.sync_channel_chats = true` (default), incoming Telegram/WhatsApp messages for a product MUST persist to the same `product_chats.id` used by the web. The inserted message row MUST carry `source_channel` (`telegram` | `whatsapp`) and the external message id in `source_ref`. When the flag is false, channel conversations MUST NOT write to `product_chat_messages`.

#### Scenario: Telegram message appears in web thread
- **WHEN** `sync_channel_chats = true` and a Telegram message is processed for product X
- **THEN** reloading the web chat for product X shows the user message (with `source_channel = 'telegram'` badge) and the assistant response

#### Scenario: Flag off suppresses persistence
- **WHEN** `sync_channel_chats = false` and a Telegram message is processed
- **THEN** no new row appears in `product_chat_messages` for that exchange

### Requirement: Chat UI

The `/products/:productId` Chat tab SHALL render the conversation with user messages right-aligned, assistant messages left-aligned, and `tool_use` + `tool_result` blocks collapsed into a disclosure (lucide `Wrench` icon, tool name, expandable input + result). Text deltas MUST render incrementally as SSE events arrive — to keep render cost low, deltas SHOULD be coalesced via `requestAnimationFrame` so per-frame `setState` is bounded.

The Chat tab MUST render the live pipeline strip (see capability `live-pipeline-visualization`) immediately above the message list whenever the product has any agent activity in the current session. The strip MUST occupy fixed vertical space so message-list scroll position is not perturbed when stage states change.

The input box MUST support multi-line input (Enter to send, Shift+Enter for newline) and clear the chat with a Dialog-confirmed "Clear" action. Cleared messages get a 5-second Undo toast that restores the in-memory snapshot if the operator changes their mind.

#### Scenario: Tool call is disclosed, not hidden
- **WHEN** the assistant calls `save_lead` with some input
- **THEN** the UI renders a collapsed row with the Wrench icon and tool name; expanding the row reveals the input JSON and the tool result

#### Scenario: Streaming text renders incrementally
- **WHEN** an assistant message streams in over several seconds
- **THEN** the rendered text updates as deltas arrive, batched per animation frame

#### Scenario: Undo restores cleared messages
- **WHEN** the operator clears the chat and clicks "Undo" within 5 seconds
- **THEN** the messages reappear locally and no `DELETE` API call is fired

#### Scenario: Pipeline strip advances during a run
- **WHEN** the orchestrator fires `load_product_context` then `run_prospect_discovery` during a chat turn
- **THEN** the strip above the message list advances `context` to running, then to done as `discovery` becomes running, without scrolling the message list

