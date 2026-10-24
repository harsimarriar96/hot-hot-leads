## Context

`product_chats` is `OneToOne(Product, unique)` and the only persisted chat. `/api/chat` is a non-streaming call to `OrchestratorAgent.handleMessage`. `BaseAgent.runStream` passes only the new text to the Claude Agent SDK `query()`.

## Decisions

- **Rename in place, not copy.** `alter table … rename` keeps ids and the message FK/index; the legacy thread is each product's first conversation by definition. `down()` is lossy (keeps the newest conversation per product) and says so.
- **Unified, organization-shared conversations.** Optional `product_id`; `chat:read` sees all, `chat:write` manages, `agents:run` sends. `created_by_user_id` is informational.
- **History lives in the system overlay, last.** The SDK's streamed `prompt` only carries user messages and `resume` sessions are local-disk, so prior turns are rendered as a bounded transcript (last 20 turns, 4 000 chars each, 24 000 total; tool results dropped, tool calls summarised to one line) appended after the canonical agent prompt.
- **Assistant message is persisted before `message_done` is emitted**, which now carries `chatId` and `assistantMessageId`; `message_start` carries `chatId`, `userMessageId` and the (possibly derived) `title`. A client refetch on `message_done` always sees the row.
- **Create-and-stream.** "New chat" is client navigation only; the first send creates the row. Abandoned drafts never litter the list.
- **Channel routing** prefers the conversation that already has messages from that channel, so a Telegram reply never lands in whichever web conversation someone is using.
- **`last_message_at` is denormalised** and maintained by the repository on append/clear; it replaces the join in `lastChatActivityAt`.

## Risks

- The hand-written DDL must match the entity decorators exactly (constraint and index names) or `migration:create` will propose a diff. Verified by regenerating the snapshot after applying the migration.
- Clients holding the old product chat routes break; the web ships in the same change and no other HTTP consumer exists.
