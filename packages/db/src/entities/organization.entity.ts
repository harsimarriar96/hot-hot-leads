import { Entity, Enum, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import type { EntitlementsPatch } from '@hothotleads/types';

import { OnboardingStatus } from '../enums';

/** A tenant. Every product, schedule and credential belongs to exactly one organization. */
@Entity({ tableName: 'organizations' })
export class Organization {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'text' })
  @Unique()
  slug!: string;

  @Property({ type: 'text', default: 'standard' })
  plan: string = 'standard';

  /** Sparse override of DEFAULT_ENTITLEMENTS; resolve with `resolveEntitlements()`. */
  @Property({ type: 'jsonb', defaultRaw: `'{}'::jsonb` })
  entitlements: EntitlementsPatch = {};

  @Property({ type: 'text', default: 'UTC' })
  timezone: string = 'UTC';

  @Property({ type: 'text', default: 'USD' })
  defaultCurrency: string = 'USD';

  @Enum({ items: () => OnboardingStatus, nativeEnumName: 'onboarding_status', default: OnboardingStatus.PENDING })
  onboardingStatus: OnboardingStatus = OnboardingStatus.PENDING;

  @Property({ type: 'boolean', default: true })
  syncChannelChats: boolean = true;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
