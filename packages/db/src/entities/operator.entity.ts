import { Entity, Enum, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Workspace } from './workspace.entity';
import { PreferredChannel } from '../enums';

@Entity({ tableName: 'operators' })
export class Operator {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Workspace, { fieldName: 'workspace_id', deleteRule: 'cascade' })
  workspace!: Workspace;

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'text' })
  @Unique()
  email!: string;

  @Enum({ items: () => PreferredChannel, nativeEnumName: 'preferred_channel', nullable: true })
  preferredChannel?: PreferredChannel;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
