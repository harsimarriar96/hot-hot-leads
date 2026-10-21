import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { Organization } from './organization.entity';
import { User } from './user.entity';
import { MembershipRole } from '../enums';

@Entity({ tableName: 'memberships' })
@Unique({ name: 'memberships_user_organization_unique', properties: ['user', 'organization'] })
@Index({ properties: ['organization'] })
export class Membership {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @ManyToOne(() => User, { fieldName: 'user_id', deleteRule: 'cascade' })
  user!: User;

  @ManyToOne(() => Organization, { fieldName: 'organization_id', deleteRule: 'cascade' })
  organization!: Organization;

  @Enum({ items: () => MembershipRole, nativeEnumName: 'membership_role', default: MembershipRole.MEMBER })
  role: MembershipRole = MembershipRole.MEMBER;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
