## Why

Once onboarding lands, the operator has a database of products but no in-app way to work with them. The current controls live behind Telegram/WhatsApp slash commands, which forces the operator into a mobile messenger for a task that belongs in the web app (reviewing leads, tweaking ICP, kicking off discovery runs). We need a first-class "Products" surface with one page per product, and on that page, a **persisted chat thread scoped to the product** that routes to `OrchestratorAgent` with the product preselected. This lets the operator drive every agent capability through the same chat primitive they already use on Telegram, with full history, tool-call transcripts, and the ability to jump back into a conversation weeks later.

## What Changes

- Add a `/products` route in the web app that lists products with quick stats (lead count, active signals, last chat activity).
- Add a `/products/:productId` detail route with three tabs: **Overview** (ICP, channels, sources, predefined prospects), **Leads** (table with filters), and **Chat** (the persistent conversation).
- Introduce `ProductChat` and `ProductChatMessage` entities in Postgres. Each product has exactly one chat thread; messages are append-only and carry roles (`user` | `assistant` | `tool`) plus structured `tool_use`/`tool_result` blocks.
- Add `ChatModule` to the API exposing: `GET /products/:productId/chat` (returns thread + messages), `POST /products/:productId/chat/messages` (posts a user message and streams the assistant response via Server-Sent Events), `DELETE /products/:productId/chat` (clears the thread).
- The `POST` endpoint calls `OrchestratorAgent.run({ productName, history, userInput, stream: true })`. Tool uses and results are persisted as they occur so the UI can replay the thread later.
- Extract a shared `ChatTranscriptService` that handles persistence of `user`/`assistant`/`tool_use`/`tool_result` blocks, independent of channel. Telegram and WhatsApp handlers are refactored to optionally use this service so Telegram conversations for a product also persist to the same thread (opt-in via a workspace flag, default on).
- Add a product edit surface: the Overview tab's ICP / channels / sources / predefined prospects are editable in place, writing to the same tables onboarding populated.
- Add a "Create product" button on `/products` that opens the same form used in onboarding step 4.
- Add a "Delete product" action (confirm modal, cascades via DB FK).

## Capabilities

### New Capabilities
- `product-management`: The `/products` list and `/products/:productId` detail surfaces — CRUD for products, ICP editing, channel editing, source editing, predefined prospect editing.
- `product-chat`: The persistent per-product conversation thread — entities, API, SSE streaming, and the web chat UI that routes to `OrchestratorAgent`.

### Modified Capabilities
<!-- None — prior changes in this series introduce the dependencies we build on. Channel handlers in apps/api get non-breaking refactors described in tasks.md. -->

## Impact

- **Depends on**: `convert-to-turborepo`, `migrate-persistence-to-postgres`, `add-onboarding-flow`. This change assumes the monorepo exists, Postgres is the datastore, a completed workspace exists, and at least one product is present.
- **DB**: adds `product_chats` (one row per product, 1:1) and `product_chat_messages` (append-only) tables. Adds a workspace-level `sync_channel_chats` boolean (default `true`) controlling whether Telegram/WhatsApp product-scoped conversations also persist to the web chat thread.
- **API**: adds `ChatModule` with `ChatController`, `ChatService`, and `ChatTranscriptService` (shared with Telegram/WhatsApp handlers). Uses SSE for streaming.
- **Web**: adds `apps/web/src/pages/products/` (list + detail, three tabs) and `apps/web/src/components/chat/` (message list, tool-call disclosure, input with send/cancel).
- **Agent loop**: `OrchestratorAgent.run(...)` gains a `stream` mode and emits events (`text_delta`, `tool_use_start`, `tool_use_result`, `message_done`). Existing callers that don't pass `stream: true` continue to work unchanged.
- **Channels**: Telegram and WhatsApp handlers are refactored to route the incoming message through `ChatService.handleIncoming(productId, senderRef, text)` instead of calling the orchestrator directly. Product selection on channels continues to work as it does today (command prefix or last-used product).
- **Out of scope**: multi-user chat, @mentions, file attachments, voice messages, separate ad-hoc chats not tied to a product, threaded replies. All deferred.
