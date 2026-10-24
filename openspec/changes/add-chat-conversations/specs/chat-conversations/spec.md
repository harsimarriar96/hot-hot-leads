## ADDED Requirements

### Requirement: Conversations are organization-scoped and optionally product-linked

The `chats` table MUST have: `id` (uuid, pk), `organization_id` (uuid, fk → organizations.id, cascade, not null), `product_id` (uuid, fk → products.id, cascade, nullable), `created_by_user_id` (uuid, fk → users.id, set null, nullable), `title` (text, nullable), `last_message_at` (timestamptz, not null, default now()), `created_at`, `updated_at`. It MUST have indexes on `(organization_id, last_message_at)` and `(product_id, last_message_at)`. An organization MAY have any number of conversations, with or without a product.

`chat_messages` keeps the columns and semantics of the former `product_chat_messages` (append-only, Anthropic-shaped `content_blocks`, `source_channel`, `source_ref`) with `chat_id` → `chats.id`.

`last_message_at` MUST be updated whenever a message is appended, so lists sort by activity without a join.

#### Scenario: Legacy thread survives as the first conversation
- **WHEN** the migration runs on a database with a `product_chats` row and its messages
- **THEN** the same id exists in `chats` with `organization_id` set from the product, `last_message_at` equal to the newest message's `created_at`, a title derived from the first user message, and every message still attached

#### Scenario: Product delete cascades
- **WHEN** a product is deleted
- **THEN** its conversations and their messages are removed

### Requirement: Conversation API

Under `/api/chats`, gated by the `chat` feature:
- `GET /api/chats?productId=` (`chat:read`) → `ChatSummary[]`, newest activity first; 404 when `productId` is not in the organization.
- `POST /api/chats { productId?, title? }` (`chat:write`) → `ChatSummary`.
- `GET /api/chats/:id` (`chat:read`) → `{ chat, messages }`; 404 when not in the organization.
- `PATCH /api/chats/:id { title }` (`chat:write`), title 1–120 characters.
- `DELETE /api/chats/:id` (`chat:write`) → 204, cascades messages.
- `DELETE /api/chats/:id/messages` (`chat:write`) → 204, clears messages, keeps the conversation.
- `POST /api/chats/:id/messages { text }` (`agents:run`) → Server-Sent Events.
- `POST /api/chats/messages { text, productId? }` (`agents:run`) → creates the conversation (creator = caller, title derived from `text`) and streams the first turn.

SSE events are `message_start { messageId, chatId, userMessageId, title }`, `text_delta`, `tool_use_start`, `tool_use_result`, `message_done { messageId, chatId, assistantMessageId, text, contentBlocks }`, `error`. The user message MUST be persisted before streaming starts and the assistant message MUST be persisted before `message_done` is emitted. If the client disconnects, the run MUST continue to completion and persist the assistant message.

A derived title is the first user message with whitespace collapsed, cut at 60 characters on a word boundary (when one exists past 30) with an ellipsis.

#### Scenario: First send creates and names the conversation
- **WHEN** `POST /api/chats/messages { text: "Generate 5 leads for Energy" }` is called
- **THEN** a new conversation exists titled "Generate 5 leads for Energy", `message_start` carries its id, and `GET /api/chats` lists it first

#### Scenario: Refetch after message_done is complete
- **WHEN** a client receives `message_done` and immediately calls `GET /api/chats/:id`
- **THEN** the response includes the assistant message with id `assistantMessageId`

### Requirement: The model sees the conversation

Each web or channel turn MUST pass the conversation's prior user and assistant turns to the orchestrator as `history`, loaded before the new user message is persisted. Turns are text only: tool results are dropped and tool calls are summarised as `[used tools: a, b]`. At most 20 turns are kept, each truncated to 4 000 characters, within a 24 000-character total; the oldest are dropped first. `BaseAgent.runStream` renders them into the system overlay after the canonical agent prompt; the user prompt stays the new message only. Sub-agent runs do not receive history.

#### Scenario: Follow-up resolves a reference
- **WHEN** a conversation contains "generate 5 leads for Energy" and its reply, and the user sends "draft outreach for the top 2"
- **THEN** the orchestrator receives both prior turns in `history` and the new message as the task

### Requirement: Channel messages route to a product conversation

When `organizations.sync_channel_chats = true` and a product is resolved, a Telegram or WhatsApp message MUST be appended to, in order of preference: the product's newest conversation that already has a message with that `source_channel`; else the product's newest conversation; else a new conversation titled `<Product> · <channel>`. When the flag is false nothing is persisted and no history is passed.

#### Scenario: Channel sticks to its own thread
- **WHEN** a product has a web conversation updated a minute ago and an older conversation containing Telegram messages
- **THEN** a new Telegram message is appended to the older Telegram conversation

### Requirement: Conversation UI

`/chat` and `/chat/:chatId` SHALL render a conversation list (newest activity first, title or "New conversation", product badge when linked, relative time) with "New chat", and per-conversation Rename and Delete (confirm dialog, 5-second Undo before the API call). Selecting a conversation loads its history; sending in `/chat` with no selection creates the conversation and navigates to `/chat/:id` without interrupting the stream. The Chat nav item stays active on `/chat/:id`.

The product Chat tab SHALL show the same list restricted to the product beside the thread; the selected conversation persists per organization and product; an empty list is a draft that creates on first send. Clear (confirm + Undo) and the pipeline strip keep their existing behaviour.

Controls requiring `chat:write` are hidden for roles without it; the composer is replaced by a read-only notice without `agents:run`.

#### Scenario: New chat then send
- **WHEN** the operator clicks New chat, types a message and presses Enter
- **THEN** the URL becomes `/chat/:id` while the reply streams, and the sidebar shows the new conversation with its derived title
