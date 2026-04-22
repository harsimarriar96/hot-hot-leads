# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HotHotLeads** is an AI-led GTM (Go-To-Market) Engineering engine built on NestJS + Claude. It:
- Reads product knowledge (ICP, strategy, signals, pricing) from a structured **Notion workspace**
- Discovers, enriches, scores leads and drafts outreach using **Claude multi-agent pipelines**
- Monitors GTM signals via **Exa** web research
- Is controlled via **Telegram** and **WhatsApp** — both on-demand and on schedule
- Writes all output (leads, outreach, feedback) back to **Notion**

## Commands

```bash
# Install dependencies
npm install

# Development (auto-reload)
npm run start:dev

# Production build + start
npm run build && npm run start:prod

# Run all tests
npm test

# Run a single test file
npm run test:single -- src/agents/orchestrator/orchestrator.agent.spec.ts

# Lint and format
npm run lint
npm run format

# Type check
npx tsc --noEmit
```

## Architecture

```
src/
├── main.ts                          # NestJS bootstrap
├── app.module.ts                    # Root module wiring
├── health.controller.ts             # GET /health
├── config/
│   └── configuration.ts            # All env vars typed
├── common/
│   └── types/                      # Shared TypeScript interfaces
│       ├── product.types.ts         # ProductKnowledge, ICP, SalesChannel, etc.
│       ├── lead.types.ts            # Lead, OutreachDraft, FeedbackEntry
│       ├── message.types.ts         # IncomingMessage, OutgoingMessage
│       └── schedule.types.ts        # Schedule
├── agents/
│   ├── base/base.agent.ts          # Abstract tool-use loop (extends this for every agent)
│   ├── orchestrator/               # Entry point — routes messages to specialized agents
│   ├── product-context/            # Fetches + summarizes Notion product knowledge
│   ├── prospect-discovery/         # Discovers companies via Exa matching ICP
│   ├── enrichment/                 # Deep-researches a company with Exa
│   ├── scoring/                    # Scores leads 0–100 against ICP
│   ├── outreach/                   # Drafts channel-specific personalized messages
│   ├── signal-monitor/             # Monitors Sources for new GTM signals
│   └── feedback/                   # Quality evaluation + Feedback Log writer
├── channels/
│   ├── telegram/                   # Webhook controller + send service
│   └── whatsapp/                   # Webhook controller + Meta Cloud API
├── integrations/
│   ├── notion/
│   │   ├── notion.service.ts       # Notion client + low-level helpers
│   │   └── repositories/
│   │       ├── products.repository.ts   # Navigates Knowledge workspace hierarchy
│   │       ├── leads.repository.ts      # Generated Leads + Outreach Queue CRUD
│   │       ├── signals.repository.ts    # Signals database CRUD
│   │       ├── schedules.repository.ts  # Schedules database CRUD
│   │       └── feedback.repository.ts   # Feedback Log CRUD
│   └── exa/
│       └── exa.service.ts          # search, findCompanies, researchCompany, monitorSignals
└── scheduler/
    └── scheduler.service.ts        # Loads schedules from Notion, registers CronJobs
```

## Agent Architecture

8 specialized agents, all extending `BaseAgent` (which owns the Claude tool-use loop):

| Agent | Role | Key Tools |
|-------|------|-----------|
| **OrchestratorAgent** | Entry point — parses intent, loads product context, routes to specialists | get_products, load_product_context, run_* |
| **ProductContextAgent** | Fetches + summarizes all Notion knowledge for a product | get_product_knowledge |
| **ProspectDiscoveryAgent** | Finds new companies matching ICP via Exa | search_companies, save_lead |
| **EnrichmentAgent** | Deep-researches a company (news, funding, hiring, tech stack) | research_company, search_web, update_lead |
| **ScoringAgent** | Scores leads 0–100 against ICP + signals | get_product_knowledge, update_lead_score |
| **OutreachAgent** | Drafts channel-specific personalized messages referencing signals | get_lead, save_outreach |
| **SignalMonitorAgent** | Monitors Sources for new GTM signals and writes them to Notion | search_signals, save_signal |
| **FeedbackAgent** | Evaluates output quality (0–10) and writes to Feedback Log | get_recent_feedback, save_feedback |

### Feedback Loop
Every significant output (lead batch, outreach draft) automatically triggers **FeedbackAgent** via `OrchestratorAgent.executeTool('run_feedback', ...)`. Feedback is stored in Notion `Output/[Product]/Feedback Log`. Run `/feedback-review` to surface patterns and ICP refinement suggestions.

## Notion Workspace Structure

```
Workspace
├── Knowledge/
│   └── [Product Name]/               ← one page per product
│         ├── General Information     (page — free text)
│         ├── Predefined Prospects    (database)
│         ├── Signals                 (database)
│         ├── Sales Strategy          (page — free text)
│         ├── Sales Channels          (page or database)
│         ├── Pricing                 (page — free text)
│         └── Sources                 (page or database)
└── Output/
    └── [Product Name]/
          ├── Generated Leads         (database)
          ├── Outreach Queue          (database)
          └── Feedback Log            (database)
```

`ProductsRepository` navigates this hierarchy dynamically — no hardcoded database IDs per product. Only the top-level `NOTION_KNOWLEDGE_PAGE_ID` and `NOTION_OUTPUT_PAGE_ID` are needed in env.

## Environment Variables

```
ANTHROPIC_API_KEY, CLAUDE_MODEL, CLAUDE_MODEL_HEAVY, CLAUDE_MODEL_FAST
TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN
NOTION_API_KEY, NOTION_KNOWLEDGE_PAGE_ID, NOTION_OUTPUT_PAGE_ID
NOTION_SCHEDULES_DATABASE_ID   # flat schedules DB (not product-scoped)
EXA_API_KEY
HOST, PORT, PUBLIC_URL, LOG_LEVEL
```

## Slash Commands (`.claude/commands/`)

| Command | What it does |
|---------|-------------|
| `/generate-leads` | Full pipeline: discovery → enrichment → scoring → feedback for a product |
| `/check-signals` | Monitor Sources via Exa, classify + save new signals |
| `/draft-outreach` | Write channel-specific personalized outreach for a lead |
| `/feedback-review` | Aggregate Feedback Log — quality trends + ICP improvement suggestions |
| `/setup-schedule` | Create a recurring task delivered to Telegram/WhatsApp |

## Key Design Decisions

- **`BaseAgent` is the only place the Anthropic SDK is called** — every specialized agent inherits the tool-use loop. To add a new agent: extend `BaseAgent`, define `systemPrompt`, `tools[]`, and `executeTool()`.
- **Product context is lazy-loaded and cached** — `ProductsRepository` caches per `productName`. Call `invalidateCache(productName)` after editing Notion.
- **Schedules survive restarts** — `SchedulerService` reads from Notion on `onApplicationBootstrap`. Registering a new schedule via chat saves to Notion and also registers the CronJob live.
- **Feedback is automatic** — `OrchestratorAgent` always calls `run_feedback` after prospect discovery and outreach. This is intentional and should not be removed.
- **WhatsApp `chatId` == phone number** — Unlike Telegram, there is no separate chat ID.
