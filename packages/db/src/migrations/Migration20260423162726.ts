import { Migration } from '@mikro-orm/migrations';

export class Migration20260423162726 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create type "onboarding_status" as enum ('pending', 'workspace_details', 'operator_profile', 'channels', 'first_product', 'completed');`);
    this.addSql(`create type "preferred_channel" as enum ('telegram', 'whatsapp');`);
    this.addSql(`create table "workspaces" ("id" uuid not null default gen_random_uuid(), "name" text not null, "timezone" text not null default 'UTC', "default_currency" text not null default 'USD', "onboarding_status" "onboarding_status" not null default 'pending', "singleton" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "workspaces_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS workspaces_singleton_unique ON workspaces (singleton) WHERE singleton = true;`);

    this.addSql(`create table "operators" ("id" uuid not null default gen_random_uuid(), "workspace_id" uuid not null, "name" text not null, "email" text not null, "preferred_channel" "preferred_channel" null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "operators_pkey" primary key ("id"));`);
    this.addSql(`alter table "operators" add constraint "operators_email_unique" unique ("email");`);

    this.addSql(`create table "channel_credentials" ("id" uuid not null default gen_random_uuid(), "workspace_id" uuid not null, "channel" "preferred_channel" not null, "credentials_ciphertext" bytea not null, "credentials_iv" bytea not null, "credentials_auth_tag" bytea not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "channel_credentials_pkey" primary key ("id"));`);
    this.addSql(`alter table "channel_credentials" add constraint "channel_credentials_workspace_channel_unique" unique ("workspace_id", "channel");`);

    this.addSql(`alter table "operators" add constraint "operators_workspace_id_foreign" foreign key ("workspace_id") references "workspaces" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "channel_credentials" add constraint "channel_credentials_workspace_id_foreign" foreign key ("workspace_id") references "workspaces" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "operators" drop constraint "operators_workspace_id_foreign";`);

    this.addSql(`alter table "channel_credentials" drop constraint "channel_credentials_workspace_id_foreign";`);

    this.addSql(`drop table if exists "workspaces" cascade;`);

    this.addSql(`drop table if exists "operators" cascade;`);

    this.addSql(`drop table if exists "channel_credentials" cascade;`);

    this.addSql(`drop type "onboarding_status";`);
    this.addSql(`drop type "preferred_channel";`);
  }

}
