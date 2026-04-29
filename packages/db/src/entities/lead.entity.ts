import {
  Collection,
  Entity,
  Enum,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Product } from './product.entity';
import { OutreachDraft } from './outreach-draft.entity';
import { LeadStatus } from '../enums';

@Entity({ tableName: 'leads' })
@Index({
  name: 'leads_product_domain_unique',
  expression:
    'CREATE UNIQUE INDEX IF NOT EXISTS leads_product_domain_unique ON leads (product_id, domain) WHERE domain IS NOT NULL',
})
export class Lead {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Product, { fieldName: 'product_id', deleteRule: 'cascade' })
  product!: Product;

  @Property({ type: 'text' })
  company!: string;

  @Property({ type: 'text', nullable: true })
  domain?: string;

  @Property({ type: 'text', nullable: true })
  industry?: string;

  @Property({ type: 'text', nullable: true })
  companySize?: string;

  @Property({ type: 'text', nullable: true })
  fundingStage?: string;

  @Property({ type: 'text', nullable: true })
  location?: string;

  @Property({ type: 'text[]', default: '{}' })
  techStack: string[] = [];

  @Property({ type: 'text', nullable: true })
  contactName?: string;

  @Property({ type: 'text', nullable: true })
  contactTitle?: string;

  @Property({ type: 'text', nullable: true })
  contactEmail?: string;

  @Property({ type: 'text', nullable: true })
  linkedinUrl?: string;

  @Property({ type: 'int', nullable: true })
  score?: number;

  @Property({ type: 'int', nullable: true })
  buyingIntent?: number;

  @Property({ type: 'text', nullable: true })
  icpFitReason?: string;

  @Property({ type: 'text', nullable: true })
  signalSummary?: string;

  @Enum({ items: () => LeadStatus, nativeEnumName: 'lead_status', default: LeadStatus.NEW })
  status: LeadStatus = LeadStatus.NEW;

  @Property({ type: 'text[]', default: '{}' })
  signals: string[] = [];

  @Property({ type: 'jsonb', nullable: true })
  enrichmentData?: Record<string, unknown>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => OutreachDraft, (d) => d.lead, { orphanRemoval: true })
  outreachDrafts = new Collection<OutreachDraft>(this);
}
