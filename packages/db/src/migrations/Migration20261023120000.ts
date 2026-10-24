import { Migration } from '@mikro-orm/migrations';

/**
 * Conversations: the single per-product thread becomes one of many organization-scoped
 * chats. `product_chats` is renamed in place to `chats` (ids are kept, so the legacy thread
 * is simply each product's first conversation) and gains organization / title / creator /
 * last-activity columns; `product_chat_messages` becomes `chat_messages`.
 *
 * `down()` is lossy by design: conversations without a product are deleted and only the
 * most recent conversation per product survives, because the old schema allowed one.
 */
export class Migration20261023120000 extends Migration {

  override async up(): Promise<void> {
    // --- product_chats -> chats ---------------------------------------------------------
    this.addSql(`alter table "product_chats" rename to "chats";`);
    this.addSql(`alter table "chats" rename constraint "product_chats_pkey" to "chats_pkey";`);
    this.addSql(`alter table "chats" rename constraint "product_chats_product_id_foreign" to "chats_product_id_foreign";`);
    this.addSql(`alter table "chats" drop constraint "product_chats_product_id_unique";`);
    this.addSql(`alter table "chats" alter column "product_id" drop not null;`);
    this.addSql(`alter table "chats" add column "organization_id" uuid null, add column "title" text null, add column "created_by_user_id" uuid null, add column "last_message_at" timestamptz null;`);
    this.addSql(`update "chats" c set "organization_id" = p."organization_id" from "products" p where p."id" = c."product_id";`);
    this.addSql(`alter table "chats" alter column "organization_id" set not null;`);
    this.addSql(`alter table "chats" add constraint "chats_organization_id_foreign" foreign key ("organization_id") references "organizations" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "chats" add constraint "chats_created_by_user_id_foreign" foreign key ("created_by_user_id") references "users" ("id") on update cascade on delete set null;`);
    this.addSql(`update "chats" c set "last_message_at" = coalesce((select max(m."created_at") from "product_chat_messages" m where m."chat_id" = c."id"), c."created_at");`);
    this.addSql(`alter table "chats" alter column "last_message_at" set not null, alter column "last_message_at" set default now();`);
    // Seed titles from the first user message so migrated threads are not untitled.
    this.addSql(`update "chats" c set "title" = left(regexp_replace(coalesce(sub."txt", ''), '\\s+', ' ', 'g'), 60) from (select distinct on ("chat_id") "chat_id", "content_blocks"->0->>'text' as "txt" from "product_chat_messages" where "role" = 'user' order by "chat_id", "created_at" asc) sub where sub."chat_id" = c."id" and nullif(sub."txt", '') is not null;`);
    this.addSql(`create index "chats_organization_last_message_idx" on "chats" ("organization_id", "last_message_at");`);
    this.addSql(`create index "chats_product_last_message_idx" on "chats" ("product_id", "last_message_at");`);

    // --- product_chat_messages -> chat_messages -----------------------------------------
    this.addSql(`alter table "product_chat_messages" rename to "chat_messages";`);
    this.addSql(`alter table "chat_messages" rename constraint "product_chat_messages_pkey" to "chat_messages_pkey";`);
    this.addSql(`alter table "chat_messages" rename constraint "product_chat_messages_chat_id_foreign" to "chat_messages_chat_id_foreign";`);
    this.addSql(`alter index "product_chat_messages_chat_created_idx" rename to "chat_messages_chat_created_idx";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter index "chat_messages_chat_created_idx" rename to "product_chat_messages_chat_created_idx";`);
    this.addSql(`alter table "chat_messages" rename constraint "chat_messages_chat_id_foreign" to "product_chat_messages_chat_id_foreign";`);
    this.addSql(`alter table "chat_messages" rename constraint "chat_messages_pkey" to "product_chat_messages_pkey";`);
    this.addSql(`alter table "chat_messages" rename to "product_chat_messages";`);

    this.addSql(`drop index "chats_product_last_message_idx";`);
    this.addSql(`drop index "chats_organization_last_message_idx";`);
    // The old model allows exactly one thread per product: drop the rest.
    this.addSql(`delete from "chats" where "product_id" is null;`);
    this.addSql(`delete from "chats" c using "chats" newer where newer."product_id" = c."product_id" and newer."id" <> c."id" and (newer."last_message_at", newer."id") > (c."last_message_at", c."id");`);
    this.addSql(`alter table "chats" drop constraint "chats_created_by_user_id_foreign";`);
    this.addSql(`alter table "chats" drop constraint "chats_organization_id_foreign";`);
    this.addSql(`alter table "chats" drop column "organization_id", drop column "title", drop column "created_by_user_id", drop column "last_message_at";`);
    this.addSql(`alter table "chats" alter column "product_id" set not null;`);
    this.addSql(`alter table "chats" add constraint "product_chats_product_id_unique" unique ("product_id");`);
    this.addSql(`alter table "chats" rename constraint "chats_product_id_foreign" to "product_chats_product_id_foreign";`);
    this.addSql(`alter table "chats" rename constraint "chats_pkey" to "product_chats_pkey";`);
    this.addSql(`alter table "chats" rename to "product_chats";`);
  }

}
