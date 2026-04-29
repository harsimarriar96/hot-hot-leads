## MODIFIED Requirements

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
