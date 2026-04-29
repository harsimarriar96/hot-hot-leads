import { Entity, Enum, Index, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

import { OnboardingStatus } from '../enums';

/**
 * Singleton workspace row. The `singleton` column is set to `true` and carries
 * a unique partial index, which makes a second insert impossible.
 */
@Entity({ tableName: 'workspaces' })
@Index({
  name: 'workspaces_singleton_unique',
  expression:
    'CREATE UNIQUE INDEX IF NOT EXISTS workspaces_singleton_unique ON workspaces (singleton) WHERE singleton = true',
})
export class Workspace {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'text', default: 'UTC' })
  timezone: string = 'UTC';

  @Property({ type: 'text', default: 'USD' })
  defaultCurrency: string = 'USD';

  @Enum({ items: () => OnboardingStatus, nativeEnumName: 'onboarding_status', default: OnboardingStatus.PENDING })
  onboardingStatus: OnboardingStatus = OnboardingStatus.PENDING;

  @Property({ type: 'boolean', default: true })
  singleton: boolean = true;

  @Property({ type: 'boolean', default: true })
  syncChannelChats: boolean = true;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
