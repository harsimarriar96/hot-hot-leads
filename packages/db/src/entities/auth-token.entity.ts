import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Organization } from './organization.entity';
import { User } from './user.entity';
import { AuthTokenKind, MembershipRole } from '../enums';

/**
 * One-time tokens: organization invitations and password resets share a lifecycle
 * (create -> hash -> share link -> consume once -> expire), so they share a table.
 */
@Entity({ tableName: 'auth_tokens' })
@Index({ properties: ['kind', 'organization'] })
export class AuthToken {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @Enum({ items: () => AuthTokenKind, nativeEnumName: 'auth_token_kind' })
  kind!: AuthTokenKind;

  @Property({ type: 'text' })
  @Unique()
  tokenHash!: string;

  /** Lowercased. For invites: the invitee. For resets: the account email. */
  @Property({ type: 'text' })
  email!: string;

  @ManyToOne(() => User, { fieldName: 'user_id', nullable: true, deleteRule: 'cascade' })
  user?: User;

  @ManyToOne(() => Organization, { fieldName: 'organization_id', nullable: true, deleteRule: 'cascade' })
  organization?: Organization;

  @Enum({ items: () => MembershipRole, nativeEnumName: 'membership_role', nullable: true })
  role?: MembershipRole;

  @ManyToOne(() => User, { fieldName: 'invited_by_user_id', nullable: true, deleteRule: 'set null' })
  invitedBy?: User;

  @Property({ type: 'timestamptz' })
  expiresAt!: Date;

  @Property({ type: 'timestamptz', nullable: true })
  usedAt?: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();
}
