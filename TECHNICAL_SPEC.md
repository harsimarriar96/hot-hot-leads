# HotHotLeads — Technical Specification
## AI-Led GTM Engineering Platform

**Version**: 1.0
**Stack**: NestJS · TypeScript · Claude · Notion · Exa · Tavily · Perplexity
**Delivery Channels**: Telegram · WhatsApp
**Date**: 2026-03-29

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Signal Taxonomy & Tool Selection](#2-signal-taxonomy--tool-selection)
3. [Architecture](#3-architecture)
4. [Notion Workspace Structure](#4-notion-workspace-structure)
5. [Agent Definitions](#5-agent-definitions)
6. [Data Models](#6-data-models)
7. [Pipeline Flows](#7-pipeline-flows)
8. [Integration Specifications](#8-integration-specifications)
9. [Scheduling & Automation](#9-scheduling--automation)
10. [Chat Control Interface](#10-chat-control-interface)
11. [Environment Variables](#11-environment-variables)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. System Overview

HotHotLeads is an **Account-Based Marketing (ABM) engine** that runs daily to discover, enrich, score, and draft outreach for high-fit prospects — for multiple products simultaneously.

### Core Principles

- **Account-Based, Not Contact-Based** — The unit of work is a company (account). Contacts are enriched after account qualification.
- **Signal-Led** — Every lead score and every outreach message is anchored to a real, recent, verifiable signal. No cold, generic outreach.
- **Product-Scoped** — Each product (Energy, Finance, etc.) has its own ICP, prospect list, signals, channels, and strategy stored in Notion. The engine reads this at runtime — no hardcoded config.
- **Feedback-Driven** — Every pipeline run is automatically evaluated for quality. Patterns surface in a Feedback Log so the prompts and ICPs can be refined over time.
- **Chat-Native** — Operators interact via Telegram or WhatsApp. The system responds in natural language and writes structured data to Notion.

### What the Engine Does Daily

```
For each product:
  1. Read ICP, Predefined Prospects, Signals, Sources from Notion
  2. Monitor Sources for new signals (social, hiring, news, regulatory)
  3. Discover new companies matching ICP (if prospect list not exhaustive)
  4. Enrich each company (funding, hiring intent, tech stack, news)
  5. Score each lead 0–100 against ICP + active signals
  6. Draft personalized outreach for leads scoring ≥ 60
  7. Write everything to Notion (leads, outreach, signals)
  8. Run quality feedback pass → write to Feedback Log
  9. Send summary to operator via Telegram / WhatsApp
```

---

## 2. Signal Taxonomy & Tool Selection

This is the most important design decision in the system. Every lead interaction must be backed by a **trigger** — a real, recent event that makes outreach relevant. We define five signal categories.

---

### 2.1 Signal Categories

| Category | What It Detects | Examples |
|----------|----------------|---------|
| **Content & Social** | What companies / founders are publicly saying or amplifying | LinkedIn posts about pain points, thought leadership on problems you solve, Twitter/X threads, job descriptions describing your use case |
| **Hiring & Org** | Team growth indicating budget, build intent, or tool gaps | New VP Sales hired, open roles in "data engineering", "compliance", "renewables" |
| **Company Activity** | Corporate milestones and momentum signals | Funding rounds, acquisitions, new market entries, customer announcements |
| **Regulatory & Industry** | External policy or market shifts creating urgency | New compliance mandates, energy pricing changes, ESG reporting rules, SEC guidance |
| **High Probability Buying** | Composite indicators that the account is actively evaluating solutions | Combination of: visiting pricing pages, downloading whitepapers (if trackable), multiple signals co-occurring within 30 days |

---

### 2.2 Tool Selection Rationale

#### Content & Social Triggers → **Tavily**

**Why Tavily over alternatives:**

| Option | Verdict | Reason |
|--------|---------|--------|
| Apify | Not recommended | Requires managing scraper actors, JavaScript rendering, anti-bot handling. Significant infra overhead. LinkedIn scraping violates ToS and breaks frequently. |
| LinkedIn Posts API | Not recommended | Restricted access (requires LinkedIn Marketing Developer Platform approval). Expensive. Not suitable for monitoring specific company pages at scale. |
| Claude / GPT directly | Not viable for this | LLMs don't fetch real-time web data. Can only process data you pass to them. |
| **Tavily** | **Recommended** | Real-time web search API. Returns recent results with content snippets. Has `include_domains` filter (e.g., `linkedin.com`). Has `search_depth: advanced` mode for richer context. Simple REST API. No scraping infra. Best recency + contextualization tradeoff. |

**Tavily usage pattern:**
```
Search: "[company name] site:linkedin.com OR site:twitter.com"
Search: "[industry keyword] regulatory compliance 2025"
Search: "[company name] hiring data engineer OR ML engineer"
Filter: published_after = last 14 days
```

#### Hiring & Organizational Triggers → **Exa**

Already integrated. Exa's neural search is excellent for finding job postings, leadership announcements, and org change signals because it understands semantic context (finds "head of growth" even when querying "VP Sales hire").

**Exa usage pattern:**
```
Search: "[company name] new CTO OR VP hiring announcement"
Search: "site:linkedin.com/jobs [company name] [role keyword]"
Category: company (for org-level results)
```

#### Company Activity Triggers → **Exa**

Already integrated. Exa excels at news monitoring and company event detection. Its `category: news` mode surfaces funding, acquisition, and product launch news with good recency.

**Exa usage pattern:**
```
Search: "[company name] funding round Series A B C"
Search: "[company name] acquisition partnership announcement"
Date filter: last 30 days
```

#### Regulatory & Industry Triggers → **Perplexity**

**Why Perplexity for regulatory:**

Regulatory and policy content is highly specialized — dense with legal language, buried in government portals, and requires understanding of precedent and jurisdiction. Perplexity's web search with citation is the best tool for this because:
- It synthesizes regulatory content intelligently (not just keyword matches)
- Returns cited, structured summaries of policy changes
- Handles domain-specific queries like "FERC Order 2222 compliance deadline" or "SEC climate disclosure rule effective date"
- Better than Exa for regulatory because it reasons over content, not just retrieves

**Perplexity usage pattern:**
```
Query: "New energy regulations affecting [industry segment] 2025"
Query: "ESG reporting mandates effective Q2 2025 for [company size]"
Query: "Recent SEC or FERC rulings affecting [product domain]"
```

#### High Probability Buying Signals → **Custom Claude Agent**

No third-party tool needed. This is a **composite scoring agent** that takes all gathered signals for a company and reasons over them using Claude to determine buying intent probability.

**Logic:**
- Multiple signals co-occurring in a short window = high intent
- Signal recency weighted heavily (last 7 days > last 30 days)
- Signal type combinations that indicate active evaluation (e.g., hiring "compliance officer" + regulatory change in their sector = very high)
- Output: a 0–100 buying intent score with reasoning

---

### 2.3 Signal Source Summary

```
Content & Social       → Tavily (new integration)
Hiring & Org           → Exa (existing)
Company Activity       → Exa (existing)
Regulatory & Industry  → Perplexity (new integration)
High Probability Buying → Claude agent (new agent logic)
```

---

## 3. Architecture

### 3.1 Directory Structure

```
src/
├── main.ts
├── app.module.ts
├── health.controller.ts
├── config/
│   └── configuration.ts
├── common/
│   └── types/
│       ├── product.types.ts
│       ├── lead.types.ts
│       ├── message.types.ts
│       └── schedule.types.ts
├── agents/
│   ├── base/
│   │   └── base.agent.ts                    # Abstract tool-use loop
│   ├── orchestrator/
│   │   └── orchestrator.agent.ts            # Entry point, intent router
│   ├── product-context/
│   │   └── product-context.agent.ts         # Loads Notion product knowledge
│   ├── prospect-discovery/
│   │   └── prospect-discovery.agent.ts      # ICP-based company discovery
│   ├── enrichment/
│   │   └── enrichment.agent.ts              # Deep company research
│   ├── scoring/
│   │   └── scoring.agent.ts                 # Lead scoring 0–100
│   ├── outreach/
│   │   └── outreach.agent.ts                # Message drafting
│   ├── signal-monitor/
│   │   └── signal-monitor.agent.ts          # Signal detection (all sources)
│   ├── buying-intent/
│   │   └── buying-intent.agent.ts           # NEW: composite buying intent score
│   └── feedback/
│       └── feedback.agent.ts                # Quality evaluation
├── channels/
│   ├── telegram/
│   │   ├── telegram.controller.ts
│   │   └── telegram.service.ts
│   └── whatsapp/
│       ├── whatsapp.controller.ts
│       └── whatsapp.service.ts
├── integrations/
│   ├── notion/
│   │   ├── notion.service.ts
│   │   └── repositories/
│   │       ├── products.repository.ts
│   │       ├── leads.repository.ts
│   │       ├── signals.repository.ts
│   │       ├── schedules.repository.ts
│   │       └── feedback.repository.ts
│   ├── exa/
│   │   └── exa.service.ts                   # Existing: hiring, news, company search
│   ├── tavily/
│   │   └── tavily.service.ts                # NEW: social/content search
│   └── perplexity/
│       └── perplexity.service.ts            # NEW: regulatory/policy search
└── scheduler/
    ├── scheduler.module.ts
    └── scheduler.service.ts
```

### 3.2 Agent Graph

```
User (Telegram / WhatsApp)
          │
          ▼
  OrchestratorAgent
  ┌─────────────────────────────────────────────────────┐
  │  Reads intent → loads product context → routes      │
  └─────────────────────────────────────────────────────┘
          │
    ┌─────┴──────────────────────────────────┐
    │             │            │             │
    ▼             ▼            ▼             ▼
SignalMonitor  Prospect    Enrichment    Outreach
   Agent      Discovery     Agent        Agent
              Agent
    │             │            │             │
    └─────┬───────┘            │             │
          ▼                    │             │
      Scoring                  │             │
       Agent  ◄────────────────┘             │
          │                                  │
          └──────────────────────────────────┘
                        │
                        ▼
                   Feedback Agent
                        │
                        ▼
                  Notion (all output)
```

### 3.3 BaseAgent Pattern

Every agent extends `BaseAgent`. This is the only place the Anthropic SDK is called.

```typescript
abstract class BaseAgent {
  protected abstract systemPrompt: string;
  protected abstract tools: Anthropic.Tool[];
  protected abstract executeTool(name: string, input: Record<string, unknown>): Promise<unknown>;

  async run(userMessage: string, model?: string): Promise<string> {
    // Multi-turn tool-use loop
    // Dispatches to executeTool() on each tool call
    // Returns final text response
    // Max 20 turns
  }
}
```

To add a new agent: extend `BaseAgent`, define `systemPrompt`, `tools[]`, `executeTool()`. Nothing else needed.

---

## 4. Notion Workspace Structure

### 4.1 Full Hierarchy

```
Notion Workspace
│
├── Knowledge/                                    ← NOTION_KNOWLEDGE_PAGE_ID
│   └── [Product Name]/                           ← one sub-page per product (e.g., "Energy", "Finance")
│         ├── General Information                 (page — free text: what the product does, who it serves)
│         ├── Predefined Prospects                (database — list of target companies)
│         ├── Signals                             (database — detected GTM signals)
│         ├── Sales Strategy                      (page — free text: positioning, objection handling)
│         ├── Sales Channels                      (page or database — LinkedIn, email, cold call, etc.)
│         ├── Pricing                             (page — free text: tiers, packaging, deal sizes)
│         └── Sources                             (page or database — URLs, news sources, LinkedIn searches)
│
└── Output/                                       ← NOTION_OUTPUT_PAGE_ID
    └── [Product Name]/                           ← auto-created per product
          ├── Generated Leads                     (database — enriched, scored accounts)
          ├── Outreach Queue                      (database — drafted messages ready to send)
          └── Feedback Log                        (database — quality scores per pipeline run)

Schedules                                         ← NOTION_SCHEDULES_DATABASE_ID (flat, top-level)
```

### 4.2 Predefined Prospects Database Schema

This is the **master account list** for ABM. The engine enriches and scores these accounts on every run.

| Field | Type | Description |
|-------|------|-------------|
| Name | title | Company name |
| Domain | url | Company website |
| Industry | select | Primary industry vertical |
| HQ Location | text | City, Country |
| Company Size | select | 1-10, 11-50, 51-200, 201-500, 500+ |
| Priority | select | High / Medium / Low |
| Notes | text | Manual context from sales team |
| Status | select | Active / Paused / Disqualified |
| Last Enriched | date | Last time the engine updated this account |

### 4.3 Signals Database Schema (per product)

| Field | Type | Description |
|-------|------|-------------|
| Name | title | Signal headline |
| Company | text | Company it relates to |
| Type | select | content_social / hiring_org / company_activity / regulatory / buying_intent |
| Source | select | tavily / exa / perplexity / manual |
| Source URL | url | Original link |
| Description | text | What the signal means for this product |
| Relevance Score | number | 0–10, how relevant to ICP |
| Detected At | date | When the signal was first detected |
| Expires At | date | When it becomes stale (default +30 days) |

### 4.4 Generated Leads Database Schema

| Field | Type | Description |
|-------|------|-------------|
| Name | title | Company name |
| Domain | url | Website |
| Contact Name | text | Primary contact |
| Contact Title | text | Job title |
| Email | email | Contact email |
| LinkedIn | url | Contact LinkedIn |
| Industry | select | Industry vertical |
| Company Size | select | Headcount band |
| Funding Stage | select | Bootstrap / Seed / Series A / B / C / Public |
| Score | number | 0–100 overall fit score |
| Buying Intent | number | 0–100 composite buying intent |
| ICP Fit Reason | text | Why this account fits |
| Active Signals | multi_select | Signal types currently active |
| Signal Summary | text | Human-readable summary of active signals |
| Tech Stack | multi_select | Detected technologies |
| Status | select | new / enriched / scored / outreach_ready / contacted / qualified / disqualified |
| Last Updated | date | Last pipeline touch |
| Source | select | exa / predefined / manual |
| Product | select | Which product this lead is for |

### 4.5 Outreach Queue Database Schema

| Field | Type | Description |
|-------|------|-------------|
| Name | title | "[Company] — [Channel] outreach" |
| Company | text | Target company |
| Contact Name | text | Recipient |
| Channel | select | linkedin_dm / email / cold_call / whatsapp |
| Subject | text | Email subject line (if applicable) |
| Body | text | Full message body |
| Tone | select | professional / warm / direct / consultative |
| Signal Hook | text | The specific signal the message references |
| Status | select | draft / approved / sent / replied / qualified |
| Score at Draft | number | Lead score when outreach was drafted |
| Product | select | Which product |
| Created At | date | |

---

## 5. Agent Definitions

### 5.1 OrchestratorAgent

**Role**: Parse user intent, load product context, route to specialist agents.

**System Prompt Responsibilities**:
- Always call `get_products` first to enumerate available products
- Load product context before any pipeline work
- Route intelligently: "generate leads" → prospect-discovery + enrichment + scoring + outreach
- Automatically trigger feedback after every major output
- Format responses for chat: concise summary + link to Notion

**Tools**:
| Tool | Action |
|------|--------|
| `get_products` | List all products from Notion |
| `load_product_context` | Fetch full ICP + strategy for a product |
| `run_signal_monitor` | Invoke SignalMonitorAgent |
| `run_prospect_discovery` | Invoke ProspectDiscoveryAgent |
| `run_enrichment` | Invoke EnrichmentAgent for a company |
| `run_scoring` | Invoke ScoringAgent for a lead |
| `run_outreach` | Invoke OutreachAgent for a lead |
| `run_buying_intent` | Invoke BuyingIntentAgent for a lead |
| `run_feedback` | Invoke FeedbackAgent (auto-called after each pipeline) |
| `save_schedule` | Register a new recurring task |

---

### 5.2 SignalMonitorAgent

**Role**: Scan all configured Sources for new GTM signals across all five signal categories.

**System Prompt Responsibilities**:
- For each source URL / keyword in the Sources list, search for signals in last 7–14 days
- Classify each signal by type (content_social / hiring_org / company_activity / regulatory / buying_intent)
- Score relevance 0–10 against the product ICP
- Deduplicate against existing signals in Notion
- Save new signals with expiry dates

**Tools**:
| Tool | Action |
|------|--------|
| `get_product_sources` | Load Sources list from Notion |
| `search_social_content` | Tavily search for content/social signals |
| `search_hiring_signals` | Exa search for hiring/org change signals |
| `search_company_activity` | Exa search for news/funding/acquisitions |
| `search_regulatory` | Perplexity search for regulatory/policy changes |
| `get_existing_signals` | Load existing signals from Notion (for dedup) |
| `save_signal` | Write new signal to Notion |

**Signal Detection Prompts** (per type):

```
Content & Social (Tavily):
  "[company] problem with [product domain] site:linkedin.com"
  "[industry] [pain point keyword] discussion 2025"

Hiring & Org (Exa):
  "[company] new VP [relevant function] announcement"
  "[company] hiring [role keyword] job posting"

Company Activity (Exa):
  "[company] funding Series [A/B/C] announcement"
  "[company] acquisition expansion new market"

Regulatory (Perplexity):
  "New [regulation type] compliance requirement [year] affecting [industry]"
  "[regulatory body] ruling [industry domain] 2025"
```

---

### 5.3 ProspectDiscoveryAgent

**Role**: Find new companies matching the product ICP. Used when the Predefined Prospects list needs augmenting.

**System Prompt Responsibilities**:
- Read ICP from product context
- Search Exa for matching companies in target industries/geographies
- Filter against Predefined Prospects to avoid duplicates
- Save new companies to Generated Leads with status = "new"

**Tools**:
| Tool | Action |
|------|--------|
| `get_product_knowledge` | Load ICP, existing prospects |
| `search_companies` | Exa company search by category + keywords |
| `check_existing_lead` | Check if company already exists in Generated Leads |
| `save_lead` | Create new lead in Notion |

**Note**: If the Predefined Prospects database is exhaustive (the operator has defined all target accounts), this agent is skipped in the daily run. It runs on-demand or weekly.

---

### 5.4 EnrichmentAgent

**Role**: Deep-research a target company to populate all known fields before scoring.

**System Prompt Responsibilities**:
- Enrich from multiple angles: news, funding, hiring intent, tech stack, key contacts
- Prioritize recency (last 90 days)
- Source everything — no fabrication
- Update lead in Notion with enrichment data

**Tools**:
| Tool | Action |
|------|--------|
| `research_company` | Exa parallel research (news + funding + hiring + tech) |
| `search_web` | Tavily targeted follow-up searches |
| `search_contacts` | Exa/Tavily for key decision-maker info |
| `update_lead` | Write enrichment data back to Notion lead |

**Enrichment Data Points**:
- Recent news (funding, product launches, executive hires)
- Funding history and current stage
- Active job postings (especially titles relevant to ICP)
- Tech stack (detected from job postings, Builtwith-style signals)
- Key contacts (CTO, VP Engineering, Head of [relevant function])

---

### 5.5 ScoringAgent

**Role**: Score each enriched lead 0–100 against the product ICP and active signals.

**Scoring Dimensions**:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Industry Match | 25% | How closely the company's industry matches ICP |
| Company Size Fit | 20% | Headcount / revenue band alignment |
| Funding Stage | 15% | Whether funding stage matches target buyer profile |
| Active Signals | 25% | Number, recency, and type of GTM signals |
| Buying Intent | 15% | Composite buying intent score from BuyingIntentAgent |

**Score Bands**:
| Band | Score | Action |
|------|-------|--------|
| Hot | 80–100 | Immediate outreach queue |
| Warm | 60–79 | Draft outreach, hold for review |
| Lukewarm | 40–59 | Continue monitoring, no outreach yet |
| Poor | 0–39 | Disqualify, archive |

**Tools**:
| Tool | Action |
|------|--------|
| `get_product_knowledge` | Load ICP for comparison |
| `get_lead` | Fetch enriched lead data |
| `get_active_signals` | Fetch signals for this company |
| `update_lead_score` | Write score + reasoning to Notion |

---

### 5.6 BuyingIntentAgent (New)

**Role**: Analyze co-occurring signals to determine the probability that an account is actively evaluating solutions.

**Logic**:

```
High intent indicators (each adds to score):
  + Signal count ≥ 3 in last 30 days              → +30 pts
  + Regulatory change directly affecting them      → +25 pts
  + Hiring for role that implies tool gap          → +20 pts
  + Funding round in last 60 days                 → +20 pts
  + Leadership change (new exec in buyer role)    → +20 pts
  + Public content expressing pain point          → +15 pts
  + Signal in last 7 days (recency bonus)         → +10 pts per recent signal

Low intent indicators:
  - No signals in last 30 days                   → -20 pts
  - Recently completed similar initiative        → -30 pts
  - Signals are generic / low-relevance          → -15 pts
```

**Tools**:
| Tool | Action |
|------|--------|
| `get_signals_for_company` | Load all recent signals for this account |
| `get_product_knowledge` | Load ICP + buying profile |
| `update_lead_buying_intent` | Write intent score to lead in Notion |

---

### 5.7 OutreachAgent

**Role**: Draft channel-specific, signal-anchored outreach messages.

**System Prompt Responsibilities**:
- Every message must open with a specific, named signal ("I noticed you recently hired a Chief Compliance Officer...")
- Tone must match the Sales Channel definition from Notion
- CTA must be clear and low-friction (30-min call, quick reply, etc.)
- Generate one draft per relevant channel defined in Sales Channels
- Never fabricate signals or assume knowledge not in context

**Tools**:
| Tool | Action |
|------|--------|
| `get_product_knowledge` | Load strategy, channels, pricing, value props |
| `get_lead` | Fetch enriched lead + contact data |
| `get_signals_for_company` | Load active signals to anchor the message |
| `save_outreach` | Write draft to Outreach Queue in Notion |

**Outreach Template Structure**:
```
[Signal Hook]    → "I noticed [specific, sourced observation]..."
[Relevance]      → "This matters for [reason tied to product]..."
[Value Prop]     → "We help companies like [comp name] [outcome]..."
[Proof]          → "For example, [similar company] [result]..." (only if available)
[CTA]            → "Would it make sense to [low-friction ask]?"
[Signature]      → [Name, title, company]
```

---

### 5.8 FeedbackAgent

**Role**: Evaluate output quality and write structured feedback to the Feedback Log.

**Scoring Criteria** (per agent run):
- **Prospect Discovery**: ICP match accuracy, signal recency, company relevance
- **Enrichment**: Data accuracy, source quality, completeness
- **Scoring**: Score justification, disqualification rationale
- **Outreach**: Signal specificity, tone match, CTA clarity, personalization depth
- **Signal Monitor**: Signal novelty, classification accuracy, relevance to product

**Quality Bands**:
| Score | Meaning |
|-------|---------|
| 8–10 | Excellent — no changes needed |
| 5–7 | Acceptable — minor improvements suggested |
| < 5 | Needs rework — specific issues logged |

**Tools**:
| Tool | Action |
|------|--------|
| `get_product_knowledge` | Load ICP + strategy as quality benchmark |
| `get_recent_feedback` | Check prior feedback to surface trends |
| `save_feedback` | Write quality evaluation to Notion Feedback Log |

---

## 6. Data Models

### 6.1 ProductKnowledge

```typescript
interface ProductKnowledge {
  name: string;
  generalInfo: string;
  predefinedProspects: PredefinedProspect[];
  signals: SignalRecord[];
  salesStrategy: string;
  salesChannels: SalesChannel[];
  pricing: string;
  sources: SourceRecord[];
  outputIds: ProductOutputIds;
}

interface PredefinedProspect {
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
  status?: 'active' | 'paused' | 'disqualified';
}

interface SalesChannel {
  name: string;               // linkedin_dm | email | cold_call | whatsapp
  description: string;        // tone and strategy guidance
  messageLength?: string;     // short | medium | long
}

interface SourceRecord {
  name: string;
  url?: string;
  type?: string;              // news_site | linkedin | twitter | industry_forum
  keywords?: string[];        // search terms to use when monitoring
}
```

### 6.2 Lead

```typescript
interface Lead {
  id?: string;                    // Notion page ID
  companyName: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  fundingStage?: string;
  contactName?: string;
  contactTitle?: string;
  email?: string;
  linkedin?: string;
  score?: number;                 // 0–100
  buyingIntent?: number;          // 0–100
  icpFitReason?: string;
  activeSignals?: string[];
  signalSummary?: string;
  techStack?: string[];
  status: LeadStatus;
  product: string;
  source?: 'exa' | 'predefined' | 'manual';
  lastUpdated?: string;
  // Enrichment fields
  recentNews?: string;
  fundingHistory?: string;
  activeJobPostings?: string[];
}

type LeadStatus =
  | 'new'
  | 'enriched'
  | 'scored'
  | 'outreach_ready'
  | 'contacted'
  | 'qualified'
  | 'disqualified';
```

### 6.3 Signal

```typescript
interface SignalRecord {
  id?: string;
  name: string;
  company?: string;
  type: SignalType;
  source: 'tavily' | 'exa' | 'perplexity' | 'manual';
  sourceUrl?: string;
  description: string;
  relevanceScore?: number;        // 0–10
  detectedAt: string;
  expiresAt?: string;
  product: string;
}

type SignalType =
  | 'content_social'
  | 'hiring_org'
  | 'company_activity'
  | 'regulatory'
  | 'buying_intent';
```

### 6.4 OutreachDraft

```typescript
interface OutreachDraft {
  id?: string;
  companyName: string;
  contactName?: string;
  channel: 'linkedin_dm' | 'email' | 'cold_call' | 'whatsapp';
  subject?: string;
  body: string;
  tone: 'professional' | 'warm' | 'direct' | 'consultative';
  signalHook: string;             // The specific signal used as the opening hook
  status: 'draft' | 'approved' | 'sent' | 'replied' | 'qualified';
  scoreAtDraft?: number;
  product: string;
}
```

---

## 7. Pipeline Flows

### 7.1 Daily ABM Pipeline (Full Run)

```
Trigger: Scheduler (daily at 09:00) or chat command "generate leads for [product]"
                │
                ▼
        OrchestratorAgent
        load_product_context([product])
                │
          ┌─────▼──────────────────────────────────────────────────────┐
          │                  PHASE 1: Signal Detection                 │
          │                                                            │
          │  SignalMonitorAgent                                        │
          │  ├─ search_social_content()    → Tavily                   │
          │  ├─ search_hiring_signals()    → Exa                      │
          │  ├─ search_company_activity()  → Exa                      │
          │  └─ search_regulatory()        → Perplexity               │
          │                                                            │
          │  Dedup → Save new signals to Notion                       │
          └─────┬──────────────────────────────────────────────────────┘
                │
          ┌─────▼──────────────────────────────────────────────────────┐
          │                  PHASE 2: Account Work                     │
          │                                                            │
          │  For each company in Predefined Prospects (active):       │
          │                                                            │
          │    EnrichmentAgent                                        │
          │    ├─ research_company()    → Exa (news, funding, hiring) │
          │    └─ search_web()          → Tavily (targeted follow-up) │
          │                                                            │
          │    BuyingIntentAgent                                      │
          │    └─ analyze co-occurring signals → intent score 0–100  │
          │                                                            │
          │    ScoringAgent                                           │
          │    └─ score 0–100 → update lead in Notion                │
          └─────┬──────────────────────────────────────────────────────┘
                │
          ┌─────▼──────────────────────────────────────────────────────┐
          │                 PHASE 3: Outreach Drafting                 │
          │                                                            │
          │  For each lead with score ≥ 60:                          │
          │                                                            │
          │    OutreachAgent                                          │
          │    ├─ load active signals for this company               │
          │    ├─ draft per-channel message                          │
          │    └─ save to Outreach Queue in Notion                   │
          └─────┬──────────────────────────────────────────────────────┘
                │
          ┌─────▼──────────────────────────────────────────────────────┐
          │                  PHASE 4: Feedback                         │
          │                                                            │
          │  FeedbackAgent                                            │
          │  ├─ evaluate signal quality                               │
          │  ├─ evaluate lead scores                                  │
          │  ├─ evaluate outreach quality                             │
          │  └─ save to Feedback Log in Notion                        │
          └─────┬──────────────────────────────────────────────────────┘
                │
                ▼
        Summary sent to operator via Telegram / WhatsApp
        Format:
          📊 [Product] Daily Run — [date]
          Signals detected: N (X new)
          Accounts enriched: N
          Hot leads (80+): N
          Outreach drafted: N messages
          Quality score: N/10
          [Link to Notion Output page]
```

### 7.2 On-Demand: Check Signals Only

```
User: "check signals for Finance"
          │
          ▼
  OrchestratorAgent → run_signal_monitor("Finance")
          │
          ▼
  SignalMonitorAgent runs all 4 signal searches
          │
          ▼
  Returns: "Found 3 new signals for Finance:
    1. [Company A] hired new CFO (hiring_org, relevance 8/10)
    2. SEC climate disclosure rule effective Q3 2025 (regulatory, relevance 9/10)
    3. [Company B] posted LinkedIn about manual reconciliation pain (content_social, relevance 7/10)"
```

### 7.3 On-Demand: Draft Outreach for Specific Lead

```
User: "draft outreach for Acme Corp for Energy product"
          │
          ▼
  OrchestratorAgent
  → load_product_context("Energy")
  → find lead "Acme Corp" in Generated Leads
  → run_outreach("Acme Corp", "Energy")
          │
          ▼
  OutreachAgent
  → get active signals for Acme Corp
  → draft per-channel messages
  → save to Outreach Queue
          │
          ▼
  Returns: "Drafted 2 messages for Acme Corp:
    - LinkedIn DM (uses CFO hire signal)
    - Email (uses regulatory compliance signal)
    [Link to Outreach Queue in Notion]"
```

---

## 8. Integration Specifications

### 8.1 Exa (Existing)

**Library**: `exa-js`
**Used for**: Company discovery, hiring signals, news/company activity

```typescript
// Key methods
exa.search(query, { numResults, startPublishedDate, category })
exa.searchAndContents(query, { numResults, startPublishedDate, highlights })
```

**Rate limits**: Depends on plan. Add retry logic with exponential backoff.

---

### 8.2 Tavily (New Integration)

**API**: REST (`https://api.tavily.com/search`)
**Auth**: `api-key` header
**Used for**: Content/social signals, targeted enrichment follow-up

```typescript
// tavily.service.ts
interface TavilySearchParams {
  query: string;
  search_depth?: 'basic' | 'advanced';  // advanced for richer snippets
  include_domains?: string[];            // e.g., ['linkedin.com', 'twitter.com']
  exclude_domains?: string[];
  max_results?: number;                  // default 5
  include_answer?: boolean;              // AI summary of results
  days?: number;                         // recency filter (last N days)
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;                       // snippet
  score: number;                         // relevance score 0–1
  published_date?: string;
}
```

**Key search patterns**:
```typescript
// Find companies publicly discussing pain points (social listening)
await tavily.search({
  query: `"${companyName}" "${painKeyword}" site:linkedin.com`,
  search_depth: 'advanced',
  days: 14,
  max_results: 5
})

// Find industry-wide content signals
await tavily.search({
  query: `${industryKeyword} ${painKeyword} 2025`,
  include_domains: ['linkedin.com'],
  days: 7
})
```

**Env var**: `TAVILY_API_KEY`

---

### 8.3 Perplexity (New Integration)

**API**: REST (`https://api.perplexity.ai/chat/completions`)
**Auth**: `Bearer` token
**Model**: `llama-3.1-sonar-large-128k-online` (best for real-time web, citations)
**Used for**: Regulatory and industry policy signals

```typescript
// perplexity.service.ts
interface PerplexitySearchParams {
  query: string;
  recency_filter?: 'day' | 'week' | 'month' | 'year';
  return_citations?: boolean;
  return_images?: boolean;
}

interface PerplexityResult {
  answer: string;                        // synthesized answer
  citations: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
}
```

**Key search patterns**:
```typescript
// Regulatory monitoring
await perplexity.search({
  query: `New ${regulationType} compliance requirements affecting ${industry} companies in 2025`,
  recency_filter: 'month',
  return_citations: true
})

// Industry shift detection
await perplexity.search({
  query: `${industryTrend} regulatory announcement ${year}`,
  recency_filter: 'week'
})
```

**Env var**: `PERPLEXITY_API_KEY`

---

### 8.4 Notion (Existing)

**Library**: `@notionhq/client`
**Dynamic hierarchy**: No hardcoded database IDs per product. All IDs resolved at runtime by navigating page hierarchy.

```
NOTION_KNOWLEDGE_PAGE_ID → list child pages → find "[Product Name]" → navigate to sub-pages
NOTION_OUTPUT_PAGE_ID    → list child pages → find "[Product Name]" → get database IDs
NOTION_SCHEDULES_DATABASE_ID → flat schedules DB (not product-scoped)
```

**Caching**: Product knowledge is cached in memory per product name. Invalidate with `productsRepository.invalidateCache(productName)`.

---

### 8.5 Anthropic / Claude (Existing)

**Library**: `@anthropic-ai/sdk`
**Models**:

| Use Case | Model | Env Var |
|----------|-------|---------|
| Deep reasoning (scoring, outreach, orchestration) | `claude-sonnet-4-6` | `CLAUDE_MODEL` |
| Heavy analysis (buying intent, complex enrichment) | `claude-opus-4-6` | `CLAUDE_MODEL_HEAVY` |
| Fast/cheap passes (feedback, summarization) | `claude-haiku-4-5-20251001` | `CLAUDE_MODEL_FAST` |

**All agents** inherit the tool-use loop from `BaseAgent`. Only `BaseAgent` calls the Anthropic SDK directly.

---

## 9. Scheduling & Automation

### 9.1 Schedule Data Model

```typescript
interface Schedule {
  id?: string;
  name: string;
  taskPrompt: string;          // The full prompt to run (e.g., "Generate leads for Energy product")
  frequency: 'hourly' | 'daily' | 'weekly' | 'custom';
  cronExpression?: string;     // Used when frequency = 'custom'
  userId: string;
  chatId: string;
  channel: 'telegram' | 'whatsapp';
  product?: string;            // Product scoping (optional)
  active: boolean;
  lastRun?: string;
}
```

### 9.2 Default Schedules

These are the recommended default schedules to set up for an active product:

| Schedule | Cron | Prompt |
|----------|------|--------|
| Daily lead run | `0 8 * * *` | "Run full lead generation pipeline for [Product]" |
| Signal monitor | `0 7 * * *` | "Check and save new GTM signals for [Product]" |
| Weekly feedback review | `0 9 * * 1` | "Review feedback log for [Product] and summarize quality trends" |

### 9.3 Frequency → Cron Mapping

```
hourly  → 0 * * * *
daily   → 0 9 * * *    (9am)
weekly  → 0 9 * * 1    (Monday 9am)
custom  → use cronExpression field directly
```

### 9.4 Scheduler Behavior

- Schedules are loaded from Notion on `onApplicationBootstrap`
- Each active schedule registers a NestJS CronJob
- On trigger: executes via `OrchestratorAgent`, sends result to channel
- Marks `lastRun` timestamp in Notion after each execution
- Survives process restarts (state is in Notion, not memory)

---

## 10. Chat Control Interface

### 10.1 Chat Commands

Users interact via natural language. The OrchestratorAgent interprets intent. Common patterns:

| User Message | Action |
|-------------|--------|
| "generate leads for Energy" | Full pipeline run for Energy product |
| "check signals for Finance" | Signal monitor run for Finance |
| "draft outreach for Acme Corp" | Outreach for that lead |
| "what are our hot leads this week?" | Query Generated Leads with score ≥ 80, last 7 days |
| "review feedback for Energy" | FeedbackAgent summary of recent runs |
| "run every day at 9am for Finance" | Create schedule for Finance daily run |
| "stop the daily Finance run" | Deactivate schedule in Notion |
| "what products do we have?" | List products from Knowledge workspace |

### 10.2 Response Format

All orchestrator responses follow this structure:

```
[Action completed] for [Product]

Results:
• [Key metric 1]
• [Key metric 2]
• [Key metric 3]

Quality: [score]/10 — [brief assessment]

[Link to Notion]
```

### 10.3 Supported Channels

| Channel | Auth | chatId |
|---------|------|--------|
| Telegram | HMAC SHA-256 webhook signature | Telegram chat/group ID |
| WhatsApp | Meta webhook verify token | Phone number |

---

## 11. Environment Variables

```bash
# Anthropic / Claude
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_MODEL_HEAVY=claude-opus-4-6
CLAUDE_MODEL_FAST=claude-haiku-4-5-20251001

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# WhatsApp (Meta Cloud API)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=

# Notion
NOTION_API_KEY=
NOTION_KNOWLEDGE_PAGE_ID=        # Root of Knowledge/ hierarchy
NOTION_OUTPUT_PAGE_ID=           # Root of Output/ hierarchy
NOTION_SCHEDULES_DATABASE_ID=    # Flat schedules database

# Data Sources
EXA_API_KEY=                     # Hiring, news, company discovery
TAVILY_API_KEY=                  # Social/content signals (NEW)
PERPLEXITY_API_KEY=              # Regulatory/industry signals (NEW)

# Server
HOST=0.0.0.0
PORT=3000
PUBLIC_URL=                      # For webhook registration
LOG_LEVEL=info
```

---

## 12. Implementation Roadmap

### Phase 1 — Foundation (Already Built)
- [x] BaseAgent + Claude tool-use loop
- [x] OrchestratorAgent
- [x] ProductContextAgent
- [x] ProspectDiscoveryAgent
- [x] EnrichmentAgent
- [x] ScoringAgent
- [x] OutreachAgent
- [x] SignalMonitorAgent (Exa only)
- [x] FeedbackAgent
- [x] Notion repositories (products, leads, signals, schedules, feedback)
- [x] ExaService
- [x] Telegram + WhatsApp channels
- [x] SchedulerService

### Phase 2 — Signal Expansion (Next Priority)
- [ ] **TavilyService** — social/content search
- [ ] **PerplexityService** — regulatory search
- [ ] **Extend SignalMonitorAgent** — add Tavily + Perplexity tools
- [ ] **BuyingIntentAgent** — composite intent scoring
- [ ] **Extend OrchestratorAgent** — add `run_buying_intent` tool
- [ ] **Add `buyingIntent` field** to Lead Notion database schema
- [ ] **Add signal type `buying_intent`** to signal taxonomy

### Phase 3 — ABM Hardening
- [ ] **Predefined Prospects priority queue** — Process "High" priority accounts first
- [ ] **Signal deduplication** — Hash-based dedup to avoid re-detecting same signals
- [ ] **Signal expiry** — Auto-archive signals older than 30 days
- [ ] **Lead history tracking** — Score delta over time (trending up/down)
- [ ] **Contact enrichment** — LinkedIn profile search for key decision-makers

### Phase 4 — Intelligence Layer
- [ ] **Cross-product signal correlation** — A signal relevant to Energy may also apply to Finance
- [ ] **ICP drift detection** — FeedbackAgent detects when actual high-scorers don't match defined ICP
- [ ] **Outreach A/B tracking** — Multiple variants, outcome tracking via Notion status updates
- [ ] **Warm path prioritization** — Leads with replied/opened outreach auto-escalate

### Phase 5 — Ops & Observability
- [ ] **Jest test coverage** (unit + integration for key agents)
- [ ] **OpenAPI documentation** (Swagger)
- [ ] **Rate limit handling** (retry with backoff for Exa, Tavily, Perplexity)
- [ ] **Error alerting** — Pipeline failures notify operator via Telegram
- [ ] **Run history** — Log each pipeline run to Notion with timestamp + result count

---

## Appendix A: Adding a New Product

To add a new product (e.g., "Healthcare"):

1. Create a page under `Knowledge/Healthcare/` in Notion
2. Add sub-pages/databases: General Information, Predefined Prospects, Signals, Sales Strategy, Sales Channels, Pricing, Sources
3. Fill in ICP, target companies, and sources
4. Create output page under `Output/Healthcare/`
5. Add databases: Generated Leads, Outreach Queue, Feedback Log
6. No code changes needed — the engine discovers it dynamically

## Appendix B: Adding a New Agent

To add a new specialized agent:

1. Create `src/agents/[name]/[name].agent.ts`
2. Extend `BaseAgent`
3. Define `systemPrompt` (string)
4. Define `tools` (Anthropic.Tool[])
5. Implement `executeTool(name, input)` to dispatch to services/repositories
6. Inject the agent in `app.module.ts`
7. Add a `run_[name]` tool to `OrchestratorAgent`

## Appendix C: Signal Freshness Policy

| Signal Type | Max Age Before Stale |
|-------------|---------------------|
| Content/Social | 14 days |
| Hiring/Org | 30 days |
| Company Activity | 30 days |
| Regulatory | 90 days |
| Buying Intent | 7 days (recomputed frequently) |

Signals past their max age should be excluded from scoring and outreach drafting. The BuyingIntentAgent only considers signals within the freshness window.
