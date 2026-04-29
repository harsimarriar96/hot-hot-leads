import { Migration } from '@mikro-orm/migrations';

export class Migration20260423184743 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create type "chat_role" as enum ('user', 'assistant', 'tool');`);
    this.addSql(`create type "chat_source_channel" as enum ('web', 'telegram', 'whatsapp');`);
    this.addSql(`create table "product_chats" ("id" uuid not null default gen_random_uuid(), "product_id" uuid not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "product_chats_pkey" primary key ("id"));`);
    this.addSql(`alter table "product_chats" add constraint "product_chats_product_id_unique" unique ("product_id");`);

    this.addSql(`create table "product_chat_messages" ("id" uuid not null default gen_random_uuid(), "chat_id" uuid not null, "role" "chat_role" not null, "content_blocks" jsonb not null, "source_channel" "chat_source_channel" not null default 'web', "source_ref" text null, "created_at" timestamptz not null default now(), constraint "product_chat_messages_pkey" primary key ("id"));`);
    this.addSql(`create index "product_chat_messages_chat_created_idx" on "product_chat_messages" ("chat_id", "created_at");`);

    this.addSql(`alter table "product_chats" add constraint "product_chats_product_id_foreign" foreign key ("product_id") references "products" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "product_chat_messages" add constraint "product_chat_messages_chat_id_foreign" foreign key ("chat_id") references "product_chats" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "workspaces" add column "sync_channel_chats" boolean not null default true;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "product_chat_messages" drop constraint "product_chat_messages_chat_id_foreign";`);

    this.addSql(`drop table if exists "product_chats" cascade;`);

    this.addSql(`drop table if exists "product_chat_messages" cascade;`);

    this.addSql(`alter table "workspaces" drop column "sync_channel_chats";`);

    this.addSql(`drop type "chat_role";`);
    this.addSql(`drop type "chat_source_channel";`);
  }

}
