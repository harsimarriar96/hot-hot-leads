import { Migration } from '@mikro-orm/migrations';

export class Migration20260429120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(
      `alter table "products" add constraint "products_icp_strictness_check" check ("icp_strictness" between 0 and 100);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "products" drop constraint "products_icp_strictness_check";`);
  }

}
