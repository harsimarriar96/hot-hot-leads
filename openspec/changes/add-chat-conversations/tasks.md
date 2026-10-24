## 1. Shared types
- [x] 1.1 `packages/types/src/chat.ts`: `ChatContentBlock`, `ChatSummary`, `ChatMessageView`, `ChatDetail`, `ChatSseEvent`, request bodies; re-exported from db and used by api + web.

## 2. Database
- [x] 2.1 `Chat` / `ChatMessage` entities replace `ProductChat` / `ProductChatMessage`.
- [x] 2.2 `Migration20261023120000`: rename tables and constraints, add columns, backfill org / last activity / titles, add indexes; lossy `down()`.
- [x] 2.3 `ChatsRepository` (list, create, rename, remove, append, clear, latest-for-product, latest-with-channel).
- [x] 2.4 `lastChatActivityAt` reads `chats.last_message_at`.

## 3. Agent
- [x] 3.1 `AgentRunOptions.history` + `renderHistory` appended to the system overlay.

## 4. API
- [x] 4.1 `ChatsController` under `/api/chats` with class-validator DTOs; shared `streamSse` helper.
- [x] 4.2 `ChatService.handleWebMessage` resolves/creates the chat, loads history before persisting, persists the assistant message before `message_done`.
- [x] 4.3 `handleIncoming` uses the channel routing rule and passes history.
- [x] 4.4 Remove `POST /api/chat`, the product chat routes and `OrchestratorAgent.handleMessage`.
- [x] 4.5 Specs: history rendering, history reduction, title derivation, ChatService.

## 5. Web
- [x] 5.1 `lib/sse.ts`, `lib/chats.ts`, `hooks/use-chats.ts`, `hooks/use-chat-stream.ts`.
- [x] 5.2 `components/chat/*`: content blocks, message list, composer, conversation list.
- [x] 5.3 `/chat/:chatId?` page with sidebar; product Chat tab with rail; nav `end: false`.
- [x] 5.4 Delete the simulated pipeline (`use-chat`, `chat-message`, `pipeline-widget`, `lib/pipelines`, `lib/pipeline-runtime`).

## 6. Verification
- [x] 6.1 `npx turbo run typecheck lint build test`.
- [x] 6.2 Migration up / down / up on a database with product threads.
- [x] 6.3 SSE smoke test with curl; follow-up answered from history.
- [x] 6.4 UI walk-through on both surfaces.
