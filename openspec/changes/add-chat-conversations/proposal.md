## Why

The operator has two disconnected chat surfaces. The main `/chat` page is stateless: a reload loses everything and every turn runs the orchestrator with no memory of the previous one. The product Chat tab persists a thread, but only one per product, and even there the stored history is display-only — the model never sees prior turns, so "now draft outreach for the top 3" does not work.

This change makes chat behave like the AI tools operators already use: a list of conversations, "New chat", rename and delete, and each conversation carrying its own context into the model.

## What Changes

### Data
- `product_chats` → `chats` (renamed in place, ids kept). `product_id` becomes nullable and loses its unique constraint; new `organization_id` (not null), `title`, `created_by_user_id`, `last_message_at` columns; indexes on `(organization_id, last_message_at)` and `(product_id, last_message_at)`.
- `product_chat_messages` → `chat_messages`, otherwise unchanged.
- Migrated threads are titled from their first user message.

### API
- New `/api/chats` surface: list (optionally per product), create, get, rename, delete, clear, send (SSE), and a create-and-stream route that starts a conversation with its first message in one call.
- `POST /api/chat` and `GET/POST/DELETE /api/products/:productId/chat` are **removed**; the web moves to `/api/chats` in the same change.
- `BaseAgent.runStream` accepts `history` (text-only prior turns) and renders it into the system overlay; the orchestrator's top-level run receives the conversation's recent history. Channel runs (Telegram / WhatsApp) also receive it.
- Channel messages route to the product's newest conversation that already carries that channel, else the product's newest conversation, else a new one.

### Web
- `/chat` and `/chat/:chatId` share one page: a conversation sidebar (New chat, rename, delete with undo) plus a streamed thread. The simulated progress widget is gone; real tool events drive the UI.
- The product Chat tab lists that product's conversations in a rail next to the thread. Clear + Undo and the pipeline strip are unchanged.
- One shared stream hook and message renderer for both surfaces; `ChatContentBlock` and the SSE event union move to `@hothotleads/types`.

## Capabilities

### New Capabilities
- `chat-conversations`: conversation model, `/api/chats` contract, history window, channel routing rule, conversation UI.

### Modified Capabilities
- `product-chat`: one-thread-per-product and the per-product API contract are removed; channel sync, the streaming agent, and the Chat tab UI are restated against conversations.
