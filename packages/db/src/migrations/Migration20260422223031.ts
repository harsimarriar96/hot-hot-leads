import { Migration } from '@mikro-orm/migrations';

export class Migration20260422223031 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create extension if not exists "pgcrypto";`);
    this.addSql(`create extension if not exists "pg_trgm";`);
    this.addSql(`create type "lead_status" as enum ('new', 'enriched', 'scored', 'outreach_ready', 'contacted', 'qualified', 'disqualified');`);
    this.addSql(`create type "outreach_tone" as enum ('formal', 'casual', 'friendly');`);
    this.addSql(`create type "agent_type" as enum ('orchestrator', 'product-context', 'prospect-discovery', 'enrichment', 'scoring', 'outreach', 'signal-monitor', 'buying-intent', 'feedback');`);
    this.addSql(`create type "source_type" as enum ('news', 'newsletter', 'database', 'social', 'other');`);
    this.addSql(`create type "schedule_frequency" as enum ('hourly', 'daily', 'weekly', 'custom');`);
    this.addSql(`create type "schedule_channel" as enum ('telegram', 'whatsapp');`);
    this.addSql(`create type "signal_type" as enum ('content_social', 'hiring_org', 'company_activity', 'regulatory', 'buying_intent', 'funding', 'hiring', 'news', 'product_launch', 'leadership_change');`);
    this.addSql(`create type "signal_source" as enum ('exa', 'tavily', 'perplexity', 'manual');`);
    this.addSql(`create table "products" ("id" uuid not null default gen_random_uuid(), "name" text not null, "slug" text not null, "general_info" text null, "sales_strategy" text null, "pricing" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "products_pkey" primary key ("id"));`);
    this.addSql(`alter table "products" add constraint "products_name_unique" unique ("name");`);
    this.addSql(`alter table "products" add constraint "products_slug_unique" unique ("slug");`);

    this.addSql(`create table "predefined_prospects" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "company" text not null, "domain" text null, "industry" text null, "company_size" text null, "funding_stage" text null, "icp_fit_notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "predefined_prospects_pkey" primary key ("id"));`);

    this.addSql(`create table "leads" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "company" text not null, "domain" text null, "industry" text null, "company_size" text null, "funding_stage" text null, "location" text null, "tech_stack" text[] not null default '{}', "contact_name" text null, "contact_title" text null, "contact_email" text null, "linkedin_url" text null, "score" int null, "buying_intent" int null, "icp_fit_reason" text null, "signal_summary" text null, "status" "lead_status" not null default 'new', "signals" text[] not null default '{}', "enrichment_data" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "leads_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS leads_product_domain_unique ON leads (product_id, domain) WHERE domain IS NOT NULL;`);

    this.addSql(`create table "outreach_drafts" ("id" uuid not null default gen_random_uuid(), "lead_id" uuid not null, "channel" text not null, "subject" text null, "body" text not null, "tone" "outreach_tone" not null default 'friendly', "generated_at" timestamptz not null default now(), "created_at" timestamptz not null default now(), constraint "outreach_drafts_pkey" primary key ("id"));`);

    this.addSql(`create table "feedback_entries" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "agent_type" "agent_type" not null, "input_summary" text null, "output_summary" text null, "quality_score" int not null, "issues" text[] not null default '{}', "suggestions" text[] not null default '{}', "overall_assessment" text null, "created_at" timestamptz not null default now(), constraint "feedback_entries_pkey" primary key ("id"));`);
    this.addSql(`create index "feedback_product_created_at_idx" on "feedback_entries" ("product_id", "created_at");`);

    this.addSql(`create table "product_icp" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "target_industries" text[] not null default '{}', "company_sizes" text[] not null default '{}', "funding_stages" text[] not null default '{}', "geographies" text[] not null default '{}', "buyer_personas" jsonb null, "notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "product_icp_pkey" primary key ("id"));`);
    this.addSql(`alter table "product_icp" add constraint "product_icp_product_id_unique" unique ("product_id");`);

    this.addSql(`create table "product_sales_channels" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "name" text not null, "description" text null, "template" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "product_sales_channels_pkey" primary key ("id"));`);

    this.addSql(`create table "product_sources" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "name" text not null, "url" text null, "description" text null, "type" "source_type" not null default 'other', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "product_sources_pkey" primary key ("id"));`);

    this.addSql(`create table "schedules" ("id" uuid not null default gen_random_uuid(), "product_id" uuid null, "name" text not null, "task_prompt" text not null, "frequency" "schedule_frequency" not null, "cron_expression" text null, "user_id" text not null, "chat_id" text not null, "channel" "schedule_channel" not null, "task_payload" jsonb null, "enabled" boolean not null default true, "last_run_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "schedules_pkey" primary key ("id"));`);

    this.addSql(`create table "signals" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "type" "signal_type" not null, "source" "signal_source" null, "description" text not null, "company" text null, "source_url" text null, "relevance_score" int null, "detected_at" timestamptz not null, "expires_at" timestamptz null, "created_at" timestamptz not null default now(), constraint "signals_pkey" primary key ("id"));`);
    this.addSql(`create index "signals_product_detected_at_idx" on "signals" ("product_id", "detected_at");`);

    this.addSql(`alter table "predefined_prospects" add constraint "predefined_prospects_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "leads" add constraint "leads_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "outreach_drafts" add constraint "outreach_drafts_lead_id_foreign" foreign key ("lead_id") references "leads" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "feedback_entries" add constraint "feedback_entries_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "product_icp" add constraint "product_icp_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade;`);

    this.addSql(`alter table "product_sales_channels" add constraint "product_sales_channels_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "product_sources" add constraint "product_sources_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "schedules" add constraint "schedules_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "signals" add constraint "signals_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete cascade;`);
  }

}
