import { Entity, Enum, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { PreferredChannel } from '../enums';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  /** Always stored lowercased. */
  @Property({ type: 'text' })
  @Unique()
  email!: string;

  /** Null until the user sets a password via an invite or reset link. */
  @Property({ type: 'text', nullable: true })
  passwordHash?: string;

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'boolean', default: false })
  isPlatformAdmin: boolean = false;

  @Enum({ items: () => PreferredChannel, nativeEnumName: 'preferred_channel', nullable: true })
  preferredChannel?: PreferredChannel;

  @Property({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
