## ADDED Requirements

### Requirement: One chat thread per product

Each `Product` SHALL have exactly one `ProductChat` row. The `product_chats` table MUST have: `id` (uuid, pk), `product_id` (uuid, fk → products.id, unique, not null), `created_at`, `updated_at`. A chat row MUST be created lazily the first time a message is posted for the product, OR eagerly when the product is created — implementation choice, but the contract "one chat per product" is invariant.

#### Scenario: Second chat for same product is rejected
- **WHEN** an insert is attempted with a `product_id` that already has a `product_chats` row
- **THEN** the insert fails with a unique-violation error

#### Scenario: First message creates the chat if absent
- **WHEN** a user posts a message to a product that has no chat row
- **THEN** the API creates the `product_chats` row and the `product_chat_messages` row in one transaction

### Requirement: Append-only message log

The `product_chat_messages` table MUST have: `id` (uuid, pk), `chat_id` (uuid, fk → product_chats.id), `role` (enum: user | assistant | tool), `content_blocks` (jsonb, not null), `source_channel` (enum: web | telegram | whatsapp, not null), `source_ref` (text, nullable — external message id if applicable), `created_at` (timestamptz, not null, default `now()`). Messages MUST NOT be updated in place once written; corrections are achieved by appending a new message. The table MUST have an index on `(chat_id, created_at ASC)`.

`content_blocks` SHALL be a JSON array mirroring the Anthropic messages-API structure:
- `{ "type": "text", "text": string }`
- `{ "type": "tool_use", "id": string, "name": string, "input": object }`
- `{ "type": "tool_result", "tool_use_id": string, "content": string | object, "is_error": boolean }`

#### Scenario: Update attempt fails
- **WHEN** code attempts `UPDATE product_chat_messages SET content_blocks = ...`
- **THEN** this is rejected in code review; there is no API path that performs such an update and the ORM repository has no `update` method

#### Scenario: Messages load in order
- **WHEN** `GET /products/:productId/chat` is called
- **THEN** messages are returned sorted by `created_at ASC` with no gaps and no duplicates

### Requirement: Chat API contract

The API SHALL expose:
- `GET /products/:productId/chat` → returns `{ chat: { id, createdAt, updatedAt }, messages: [...] }`.
- `POST /products/:productId/chat/messages` → body `{ text: string }`. Response is a Server-Sent Events stream (`Content-Type: text/event-stream`) with events:
  - `message_start` → user message persisted, returns `{ messageId }`.
  - `text_delta` → incremental assistant text.
  - `tool_use_start` → `{ toolUseId, name, input }`.
  - `tool_use_result` → `{ toolUseId, result, isError }`.
  - `message_done` → `{ messageId }` for the final assistant message.
  - `error` → `{ code, message }`; stream closes.
- `DELETE /products/:productId/chat` → clears messages (does not delete the chat row).

The `POST` endpoint MUST persist the user message before streaming starts. If the client disconnects mid-stream, the server MUST continue the orchestrator run to completion and persist the resulting assistant message — partial messages MUST NOT be persisted.

#### Scenario: Client disconnects mid-stream
- **WHEN** the client closes the SSE connection after a `tool_use_start` but before `message_done`
- **THEN** the orchestrator run continues on the server, and the final assistant message is persisted in full

#### Scenario: Error mid-run persists what happened
- **WHEN** a tool call throws and the orchestrator halts
- **THEN** an assistant message is persisted that includes the prior text + tool_use + tool_result(is_error=true) blocks, and an `error` SSE event is sent to the client

### Requirement: Orchestrator streaming mode

`OrchestratorAgent.run(input)` SHALL accept a `stream: true` option. When streaming, the agent MUST emit the events listed above via an async generator or callback interface. When `stream` is absent or false, `run` returns the final assistant message as a single value (preserving existing behavior).

`OrchestratorAgent.run` MUST accept `history: ProductChatMessage[]` and format it into the Anthropic `messages` array verbatim, preserving tool_use/tool_result pairs. The agent MUST NOT mutate the provided history.

#### Scenario: Non-streaming callers unaffected
- **WHEN** an existing Telegram handler calls `OrchestratorAgent.run({ productName, userInput })` with no `stream` option
- **THEN** the return value matches pre-change behavior

#### Scenario: Streamed tool events match persistence
- **WHEN** the orchestrator executes two tools during a run
- **THEN** the SSE stream emits two `tool_use_start` / `tool_use_result` pairs, and the persisted `content_blocks` array contains exactly the same two `tool_use` + `tool_result` blocks in order

### Requirement: Channel conversations persist to the same thread

When the workspace flag `sync_channel_chats` is true (default), incoming Telegram/WhatsApp messages for a product SHALL persist to the same `product_chats.id` used by the web chat. The inserted `product_chat_messages` row MUST carry the correct `source_channel` (`telegram` | `whatsapp`) and the external message id in `source_ref`.

When the flag is false, channel conversations MUST NOT write to `product_chat_messages`.

#### Scenario: Telegram message appears in web thread
- **WHEN** `sync_channel_chats = true` and a Telegram message is processed for product X
- **THEN** reloading the web chat for product X shows the user message (with `source_channel = 'telegram'` badge) and the assistant response

#### Scenario: Flag off suppresses persistence
- **WHEN** `sync_channel_chats = false` and a Telegram message is processed
- **THEN** no new row appears in `product_chat_messages` for that exchange

#### Scenario: Source channel is preserved
- **WHEN** the web client renders a message with `source_channel = 'telegram'`
- **THEN** the message is visually distinguishable from web-originated messages (icon or badge)

### Requirement: Chat UI

The `/products/:productId` Chat tab SHALL render the conversation as a vertical list with: user messages right-aligned, assistant messages left-aligned, tool_use + tool_result pairs collapsed into a disclosure with the tool name visible and the input/result expandable. Text deltas MUST render incrementally as SSE events arrive.

An input box at the bottom MUST support multi-line input (Enter to send, Shift+Enter for newline), a send button, and a cancel button that aborts the in-flight request (but does not attempt to kill the server-side run).

On first load, the message list MUST auto-scroll to the bottom. When the user scrolls up, new incoming messages MUST NOT force-scroll; instead a "Jump to latest" button appears.

#### Scenario: Tool call is disclosed, not hidden
- **WHEN** the assistant calls `save_lead` with some input
- **THEN** the UI renders a collapsed row labeled `save_lead` that the operator can expand to see input and result

#### Scenario: Streaming text renders incrementally
- **WHEN** an assistant message streams in over 3 seconds
- **THEN** the rendered text updates at least every 200ms as deltas arrive

#### Scenario: Cancel stops client without breaking server
- **WHEN** the user clicks cancel mid-stream
- **THEN** the SSE connection closes, and a subsequent page reload still shows the completed assistant message (because the server continued the run)
