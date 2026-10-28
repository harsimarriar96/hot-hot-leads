import { Migration } from '@mikro-orm/migrations';

/**
 * Signal review workflow: every signal carries a `status` (pending / approved / rejected /
 * snoozed) plus who reviewed it, when, and until when it is snoozed.
 *
 * Backfill: rows that exist before this migration are marked `approved`. Until now every
 * stored signal fed buying-intent scoring unconditionally, so approving them keeps scoring
 * exactly as it was; only signals saved from here on start in the review queue (`pending`,
 * the column default).
 */
export class Migration20261028170740 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create type "signal_status" as enum ('pending', 'approved', 'rejected', 'snoozed');`);
    this.addSql(`alter table "signals" add column "status" "signal_status" not null default 'pending', add column "reviewed_at" timestamptz null, add column "reviewed_by_user_id" uuid null, add column "snoozed_until" timestamptz null;`);
    this.addSql(`update "signals" set "status" = 'approved';`);
    this.addSql(`create index "signals_product_status_idx" on "signals" ("product_id", "status");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "signals_product_status_idx";`);
    this.addSql(`alter table "signals" drop column "status", drop column "reviewed_at", drop column "reviewed_by_user_id", drop column "snoozed_until";`);

    this.addSql(`drop type "signal_status";`);
  }

}
