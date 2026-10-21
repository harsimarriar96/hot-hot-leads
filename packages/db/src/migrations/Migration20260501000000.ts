import { Migration } from '@mikro-orm/migrations';

/**
 * Multi-tenancy: the singleton `workspaces` row becomes `organizations`, operators become
 * users with an owner membership, and every product / schedule / credential is attached
 * to its organization. Runs in place on a live single-tenant database.
 */
export class Migration20260501000000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create type "membership_role" as enum ('owner', 'admin', 'member', 'viewer');`);
    this.addSql(`create type "auth_token_kind" as enum ('invite', 'password_reset');`);

    // --- workspaces -> organizations -------------------------------------------------
    this.addSql(`alter table "workspaces" rename to "organizations";`);
    this.addSql(`alter table "organizations" rename constraint "workspaces_pkey" to "organizations_pkey";`);
    this.addSql(`drop index if exists "workspaces_singleton_unique";`);
    this.addSql(`alter table "organizations" drop column "singleton";`);
    this.addSql(`alter table "organizations" add column "slug" text null, add column "plan" text not null default 'standard', add column "entitlements" jsonb not null default '{}'::jsonb;`);
    // Dev edge case: products exist but onboarding never created a workspace row.
    this.addSql(`insert into "organizations" ("name", "slug", "onboarding_status") select 'Default', 'default', 'completed' where exists (select 1 from "products") and not exists (select 1 from "organizations");`);
    this.addSql(`update "organizations" set "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'));`);
    this.addSql(`update "organizations" set "slug" = coalesce(nullif("slug", ''), 'org') || '-' || left("id"::text, 8) where "slug" is null or "slug" = '' or "slug" in (select "slug" from "organizations" group by "slug" having count(*) > 1);`);
    this.addSql(`alter table "organizations" alter column "slug" set not null;`);
    this.addSql(`alter table "organizations" add constraint "organizations_slug_unique" unique ("slug");`);
    // The operator-profile onboarding step no longer exists.
    this.addSql(`update "organizations" set "onboarding_status" = 'channels' where "onboarding_status" = 'operator_profile';`);

    // --- channel_credentials: workspace_id -> organization_id -------------------------
    this.addSql(`alter table "channel_credentials" rename column "workspace_id" to "organization_id";`);
    this.addSql(`alter table "channel_credentials" rename constraint "channel_credentials_workspace_id_foreign" to "channel_credentials_organization_id_foreign";`);
    this.addSql(`alter table "channel_credentials" rename constraint "channel_credentials_workspace_channel_unique" to "channel_credentials_organization_channel_unique";`);

    // --- users ------------------------------------------------------------------------
    this.addSql(`create table "users" ("id" uuid not null default gen_random_uuid(), "email" text not null, "password_hash" text null, "name" text not null, "is_platform_admin" boolean not null default false, "preferred_channel" "preferred_channel" null, "last_login_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "users_pkey" primary key ("id"));`);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    // --- memberships ------------------------------------------------------------------
    this.addSql(`create table "memberships" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "organization_id" uuid not null, "role" "membership_role" not null default 'member', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "memberships_pkey" primary key ("id"));`);
    this.addSql(`alter table "memberships" add constraint "memberships_user_organization_unique" unique ("user_id", "organization_id");`);
    this.addSql(`create index "memberships_organization_id_index" on "memberships" ("organization_id");`);
    this.addSql(`alter table "memberships" add constraint "memberships_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "memberships" add constraint "memberships_organization_id_foreign" foreign key ("organization_id") references "organizations" ("id") on update cascade on delete cascade;`);

    // --- sessions ---------------------------------------------------------------------
    this.addSql(`create table "sessions" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "token_hash" text not null, "active_organization_id" uuid null, "expires_at" timestamptz not null, "last_seen_at" timestamptz not null default now(), "ip" text null, "user_agent" text null, "created_at" timestamptz not null default now(), constraint "sessions_pkey" primary key ("id"));`);
    this.addSql(`alter table "sessions" add constraint "sessions_token_hash_unique" unique ("token_hash");`);
    this.addSql(`create index "sessions_user_id_index" on "sessions" ("user_id");`);
    this.addSql(`create index "sessions_expires_at_index" on "sessions" ("expires_at");`);
    this.addSql(`alter table "sessions" add constraint "sessions_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "sessions" add constraint "sessions_active_organization_id_foreign" foreign key ("active_organization_id") references "organizations" ("id") on update cascade on delete set null;`);

    // --- auth_tokens (invites + password resets) --------------------------------------
    this.addSql(`create table "auth_tokens" ("id" uuid not null default gen_random_uuid(), "kind" "auth_token_kind" not null, "token_hash" text not null, "email" text not null, "user_id" uuid null, "organization_id" uuid null, "role" "membership_role" null, "invited_by_user_id" uuid null, "expires_at" timestamptz not null, "used_at" timestamptz null, "created_at" timestamptz not null default now(), constraint "auth_tokens_pkey" primary key ("id"));`);
    this.addSql(`alter table "auth_tokens" add constraint "auth_tokens_token_hash_unique" unique ("token_hash");`);
    this.addSql(`create index "auth_tokens_kind_organization_id_index" on "auth_tokens" ("kind", "organization_id");`);
    this.addSql(`alter table "auth_tokens" add constraint "auth_tokens_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "auth_tokens" add constraint "auth_tokens_organization_id_foreign" foreign key ("organization_id") references "organizations" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "auth_tokens" add constraint "auth_tokens_invited_by_user_id_foreign" foreign key ("invited_by_user_id") references "users" ("id") on update cascade on delete set null;`);

    // --- data: operators -> users + owner memberships (user id = operator id) ----------
    this.addSql(`insert into "users" ("id", "email", "name", "preferred_channel", "created_at", "updated_at") select "id", lower("email"), "name", "preferred_channel", "created_at", "updated_at" from "operators";`);
    this.addSql(`insert into "memberships" ("user_id", "organization_id", "role") select "id", "workspace_id", 'owner' from "operators";`);

    // --- products: organization FK + per-organization uniqueness ----------------------
    this.addSql(`alter table "products" add column "organization_id" uuid null;`);
    this.addSql(`update "products" set "organization_id" = (select "id" from "organizations" order by "created_at" limit 1);`);
    this.addSql(`alter table "products" alter column "organization_id" set not null;`);
    this.addSql(`alter table "products" add constraint "products_organization_id_foreign" foreign key ("organization_id") references "organizations" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "products" drop constraint "products_name_unique";`);
    this.addSql(`alter table "products" drop constraint "products_slug_unique";`);
    this.addSql(`alter table "products" add constraint "products_organization_name_unique" unique ("organization_id", "name");`);
    this.addSql(`alter table "products" add constraint "products_organization_slug_unique" unique ("organization_id", "slug");`);
    this.addSql(`create index "products_organization_id_index" on "products" ("organization_id");`);

    // --- schedules: organization FK + creator -----------------------------------------
    this.addSql(`alter table "schedules" add column "organization_id" uuid null, add column "created_by_user_id" uuid null;`);
    this.addSql(`update "schedules" s set "organization_id" = p."organization_id" from "products" p where p."id" = s."product_id";`);
    this.addSql(`update "schedules" set "organization_id" = (select "id" from "organizations" order by "created_at" limit 1) where "organization_id" is null;`);
    this.addSql(`update "schedules" s set "created_by_user_id" = (select m."user_id" from "memberships" m where m."organization_id" = s."organization_id" and m."role" = 'owner' order by m."created_at" limit 1);`);
    this.addSql(`alter table "schedules" alter column "organization_id" set not null;`);
    this.addSql(`alter table "schedules" add constraint "schedules_organization_id_foreign" foreign key ("organization_id") references "organizations" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "schedules" add constraint "schedules_created_by_user_id_foreign" foreign key ("created_by_user_id") references "users" ("id") on update cascade on delete set null;`);
    this.addSql(`create index "schedules_organization_id_index" on "schedules" ("organization_id");`);

    // product_icp was created with "on update cascade" only; an organization delete cascades
    // to products at the DB level, so the ICP row must cascade too.
    this.addSql(`alter table "product_icp" drop constraint "product_icp_product_id_foreign";`);
    this.addSql(`alter table "product_icp" add constraint "product_icp_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete cascade;`);

    this.addSql(`drop table "operators" cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "product_icp" drop constraint "product_icp_product_id_foreign";`);
    this.addSql(`alter table "product_icp" add constraint "product_icp_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade;`);

    this.addSql(`create table "operators" ("id" uuid not null default gen_random_uuid(), "workspace_id" uuid not null, "name" text not null, "email" text not null, "preferred_channel" "preferred_channel" null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "operators_pkey" primary key ("id"));`);
    this.addSql(`alter table "operators" add constraint "operators_email_unique" unique ("email");`);
    this.addSql(`insert into "operators" ("id", "workspace_id", "name", "email", "preferred_channel", "created_at", "updated_at") select u."id", m."organization_id", u."name", u."email", u."preferred_channel", u."created_at", u."updated_at" from "memberships" m join "users" u on u."id" = m."user_id" where m."role" = 'owner';`);

    this.addSql(`drop index "schedules_organization_id_index";`);
    this.addSql(`alter table "schedules" drop constraint "schedules_organization_id_foreign";`);
    this.addSql(`alter table "schedules" drop constraint "schedules_created_by_user_id_foreign";`);
    this.addSql(`alter table "schedules" drop column "organization_id", drop column "created_by_user_id";`);

    this.addSql(`drop index "products_organization_id_index";`);
    this.addSql(`alter table "products" drop constraint "products_organization_name_unique";`);
    this.addSql(`alter table "products" drop constraint "products_organization_slug_unique";`);
    this.addSql(`alter table "products" drop constraint "products_organization_id_foreign";`);
    this.addSql(`alter table "products" drop column "organization_id";`);
    this.addSql(`alter table "products" add constraint "products_name_unique" unique ("name");`);
    this.addSql(`alter table "products" add constraint "products_slug_unique" unique ("slug");`);

    this.addSql(`drop table if exists "auth_tokens" cascade;`);
    this.addSql(`drop table if exists "sessions" cascade;`);
    this.addSql(`drop table if exists "memberships" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);

    this.addSql(`alter table "channel_credentials" rename constraint "channel_credentials_organization_channel_unique" to "channel_credentials_workspace_channel_unique";`);
    this.addSql(`alter table "channel_credentials" rename constraint "channel_credentials_organization_id_foreign" to "channel_credentials_workspace_id_foreign";`);
    this.addSql(`alter table "channel_credentials" rename column "organization_id" to "workspace_id";`);

    this.addSql(`alter table "organizations" drop constraint "organizations_slug_unique";`);
    this.addSql(`alter table "organizations" drop column "slug", drop column "plan", drop column "entitlements";`);
    this.addSql(`alter table "organizations" add column "singleton" boolean not null default true;`);
    this.addSql(`alter table "organizations" rename constraint "organizations_pkey" to "workspaces_pkey";`);
    this.addSql(`alter table "organizations" rename to "workspaces";`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS workspaces_singleton_unique ON workspaces (singleton) WHERE singleton = true;`);

    this.addSql(`alter table "operators" add constraint "operators_workspace_id_foreign" foreign key ("workspace_id") references "workspaces" ("id") on update cascade on delete cascade;`);

    this.addSql(`drop type "auth_token_kind";`);
    this.addSql(`drop type "membership_role";`);
  }

}
