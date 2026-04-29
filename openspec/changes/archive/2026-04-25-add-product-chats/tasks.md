## 1. Schema and entities

- [x] 1.1 Add `ProductChat` entity in `packages/db/src/entities/` with `product_id` unique FK, 1:1 relation to Product
- [x] 1.2 Add `ProductChatMessage` entity with `role`, `content_blocks` (jsonb), `source_channel`, `source_ref`, `created_at`
- [x] 1.3 Define `chat_role` and `chat_source_channel` Postgres enums
- [x] 1.4 Add `sync_channel_chats` boolean column to `workspaces` with default `true`
- [x] 1.5 Create migration adding both tables, the enums, the `(chat_id, created_at ASC)` index, and the workspace column
- [x] 1.6 Add `ProductChatsRepository` with methods: `getOrCreateForProduct(productId)`, `appendMessage(chatId, input)`, `listMessages(chatId)`, `clearMessages(chatId)`
- [x] 1.7 Helper `getHistoryForOrchestrator(chatId): Array<{ role, content_blocks }>` that returns the history in the Anthropic messages-API shape

## 2. Orchestrator streaming mode

- [x] 2.1 Extend `BaseAgent.run` signature to accept `stream?: true` and, when set, return an `AsyncGenerator` of events
- [x] 2.2 Emit events: `message_start`, `text_delta`, `tool_use_start`, `tool_use_result`, `message_done`, `error`
- [x] 2.3 Ensure non-streaming callers (Telegram, WhatsApp today) are unaffected — the streaming path is additive
- [x] 2.4 Update `OrchestratorAgent` to accept `history: Array<{ role, content }>` alongside the current `productName` + `userInput` inputs, and pass history verbatim to the Anthropic messages call
- [x] 2.5 Add a unit test that runs a streaming orchestrator call end-to-end against a mocked Anthropic client, asserts the event sequence, and asserts the final persisted message equals the expected content_blocks

## 3. ChatTranscriptService and ChatService

- [x] 3.1 `ChatTranscriptService.persistUserMessage(chatId, text, sourceChannel, sourceRef?)` → returns the saved message
- [x] 3.2 `ChatTranscriptService.persistAssistantMessage(chatId, contentBlocks, sourceChannel)` → returns the saved message
- [x] 3.3 Redaction: before persisting `tool_use` blocks, scrub any field in `input` matching `/token|credential|ciphertext/i` with `"[redacted]"`
- [x] 3.4 `ChatService.handleIncoming({ productId, senderRef, text, sourceChannel })` → acquires advisory lock, persists user message, calls `OrchestratorAgent.run` non-streaming, persists assistant message, releases lock, returns final text
- [x] 3.5 `ChatService.handleWebMessage({ productId, text })` → generator that yields SSE events while persisting blocks as they complete
- [x] 3.6 Workspace flag `sync_channel_chats` gates persistence inside `handleIncoming` (channels) but NOT inside `handleWebMessage` (web always persists)

## 4. Chat API

- [x] 4.1 `ChatController.getChat(productId)` → returns `{ chat, messages }`
- [x] 4.2 `ChatController.postMessage(productId, body)` → SSE endpoint, streams events from `ChatService.handleWebMessage`
- [x] 4.3 `ChatController.clearChat(productId)` → calls `clearMessages(chatId)`, returns 204
- [x] 4.4 Set SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`
- [x] 4.5 Emit a heartbeat `:keepalive` comment every 15 seconds while a run is in flight
- [x] 4.6 Ensure client disconnect does NOT abort the underlying run — use a "detached" async context so the generator continues and the final message persists

## 5. Channel handler refactor

- [x] 5.1 Replace direct `OrchestratorAgent.run` calls in `TelegramController` with `ChatService.handleIncoming(...)` passing `sourceChannel: 'telegram'`
- [x] 5.2 Same refactor for `WhatsAppController` (`sourceChannel: 'whatsapp'`)
- [x] 5.3 When the channel message does not resolve to a product (no command prefix / no last-used), fall back to today's behavior (no persistence, direct orchestrator call) — see `ChatService.handleIncomingUntargeted(...)` helper
- [x] 5.4 Verify: an existing Telegram-driven flow (`/generate-leads Acme Product`) still works byte-for-byte on the reply side
- [x] 5.5 Verify: with `sync_channel_chats = true` (default), the same Telegram conversation appears in the web chat for that product

## 6. Products pages (web)

- [x] 6.1 `apps/web/src/pages/products/index.tsx` — list page with per-product stats; uses TanStack Query with a 10s stale time
- [x] 6.2 Empty state with "Create first product" CTA
- [x] 6.3 Create-product modal reuses the form component from onboarding step 4
- [x] 6.4 `apps/web/src/pages/products/[productId].tsx` — detail shell with tab router (overview/leads/chat), tab persisted to `localStorage` keyed by productId
- [x] 6.5 Not-found state for invalid productId

## 7. Overview tab

- [x] 7.1 `OverviewTab.tsx` showing name/general_info/sales_strategy/pricing with inline edit
- [x] 7.2 ICP editor: target industries / company sizes / funding stages / geographies (multi-select chips), icp_notes (textarea)
- [x] 7.3 Sales channels editor: list with add/remove/edit inline
- [x] 7.4 Sources editor: list with add/remove/edit inline, url validation
- [x] 7.5 Predefined prospects editor: list with add/remove/edit inline
- [x] 7.6 Each edit uses optimistic update; on 4xx/5xx, rollback + inline error
- [x] 7.7 API endpoints if missing: `PATCH /products/:id`, `PUT /products/:id/icp`, `POST/PATCH/DELETE /products/:id/sales-channels/:channelId?`, same shape for sources and predefined-prospects

## 8. Leads tab

- [x] 8.1 `LeadsTab.tsx` with columns Company / Contact / Status / Score / Updated
- [x] 8.2 Filter pill group for `status`
- [x] 8.3 Sort by `score` or `updated_at` (default `updated_at DESC`)
- [x] 8.4 Empty state suggesting to ask the chat to generate leads

## 9. Chat tab

- [x] 9.1 `ChatTab.tsx` loads history via `GET /products/:productId/chat`
- [x] 9.2 Message list component renders user / assistant messages with role-based alignment
- [x] 9.3 Tool-call disclosure: collapsed row showing `{toolName}`; expanded shows input JSON + result
- [x] 9.4 Input box: multi-line textarea, Enter sends, Shift+Enter newline, send button, cancel button
- [x] 9.5 Client-side SSE consumer using native `EventSource` (or a fetch-based fallback that supports POST body); append `text_delta` events to the in-progress assistant message, insert tool_use + tool_result blocks in place
- [x] 9.6 Auto-scroll on first load + on new message when the user is already at bottom; "Jump to latest" pill when they have scrolled up
- [x] 9.7 Cross-channel badge: messages with `source_channel !== 'web'` show a small icon/label
- [x] 9.8 "Clear conversation" action in an overflow menu (triple-dot) with confirmation modal

## 10. Delete product

- [x] 10.1 Overflow menu on product detail with "Delete product"
- [x] 10.2 Modal requires typing the product name to enable confirm
- [x] 10.3 `DELETE /products/:id` cascades via DB FK; verify leads/signals/outreach/schedules/feedback/chat rows are gone
- [x] 10.4 On success redirect to `/products`

## 11. Documentation

- [x] 11.1 Update `CLAUDE.md`: add "Product Chats" section explaining the 1:1 chat, SSE streaming, and channel sync flag
- [x] 11.2 Document the `sync_channel_chats` workspace flag in Settings UI and README
- [x] 11.3 Document the SSE streaming endpoint + required proxy settings (`X-Accel-Buffering: no`, keep-alive) in deployment notes

## 12. Verify end-to-end

- [x] 12.1 Create product → open chat → "Generate 3 leads in fintech" → SSE events arrive, tool calls visible, leads appear in Leads tab
- [x] 12.2 Reload page mid-stream → final assistant message is present on reload (server kept running)
- [x] 12.3 Telegram conversation for same product → appears in web chat with telegram badge
- [x] 12.4 Toggle `sync_channel_chats` off → Telegram messages stop appearing in the web chat
- [x] 12.5 Clear chat → messages gone, chat row preserved, posting again creates new messages in the existing chat id
- [x] 12.6 Delete product → redirects, all owned rows including chat removed
