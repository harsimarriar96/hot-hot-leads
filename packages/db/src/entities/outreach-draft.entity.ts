import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Lead } from './lead.entity';
import { OutreachTone } from '../enums';

@Entity({ tableName: 'outreach_drafts' })
export class OutreachDraft {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Lead, { fieldName: 'lead_id', deleteRule: 'cascade' })
  lead!: Lead;

  @Property({ type: 'text' })
  channel!: string;

  @Property({ type: 'text', nullable: true })
  subject?: string;

  @Property({ type: 'text' })
  body!: string;

  @Enum({ items: () => OutreachTone, nativeEnumName: 'outreach_tone', default: OutreachTone.FRIENDLY })
  tone: OutreachTone = OutreachTone.FRIENDLY;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  generatedAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();
}
