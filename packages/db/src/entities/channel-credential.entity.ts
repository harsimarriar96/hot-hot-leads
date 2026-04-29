import { Entity, Enum, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Workspace } from './workspace.entity';
import { PreferredChannel } from '../enums';

@Entity({ tableName: 'channel_credentials' })
@Unique({ name: 'channel_credentials_workspace_channel_unique', properties: ['workspace', 'channel'] })
export class ChannelCredential {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => Workspace, { fieldName: 'workspace_id', deleteRule: 'cascade' })
  workspace!: Workspace;

  @Enum({ items: () => PreferredChannel, nativeEnumName: 'preferred_channel' })
  channel!: PreferredChannel;

  @Property({ type: 'bytea' })
  credentialsCiphertext!: Buffer;

  @Property({ type: 'bytea' })
  credentialsIv!: Buffer;

  @Property({ type: 'bytea' })
  credentialsAuthTag!: Buffer;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
