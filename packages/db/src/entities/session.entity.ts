import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Organization } from './organization.entity';
import { User } from './user.entity';

/** Opaque bearer session. Only the sha256 of the token is stored. */
@Entity({ tableName: 'sessions' })
@Index({ properties: ['user'] })
@Index({ properties: ['expiresAt'] })
export class Session {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => User, { fieldName: 'user_id', deleteRule: 'cascade' })
  user!: User;

  @Property({ type: 'text' })
  @Unique()
  tokenHash!: string;

  @ManyToOne(() => Organization, {
    fieldName: 'active_organization_id',
    nullable: true,
    deleteRule: 'set null',
  })
  activeOrganization?: Organization;

  @Property({ type: 'timestamptz' })
  expiresAt!: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  lastSeenAt: Date = new Date();

  @Property({ type: 'text', nullable: true })
  ip?: string;

  @Property({ type: 'text', nullable: true })
  userAgent?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();
}
