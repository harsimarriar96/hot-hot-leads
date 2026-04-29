import { Migration } from '@mikro-orm/migrations';

export class Migration20260425013713 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create type "agent_model_tier" as enum ('fast', 'default', 'heavy');`);
    this.addSql(`alter table "products" add column "agent_model_tier" "agent_model_tier" not null default 'default', add column "agent_extra_instructions" text null, add column "icp_strictness" int not null default 60;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "products" drop column "agent_model_tier", drop column "agent_extra_instructions", drop column "icp_strictness";`);

    this.addSql(`drop type "agent_model_tier";`);
  }

}
