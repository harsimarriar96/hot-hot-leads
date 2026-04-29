import { EntityManager } from '@mikro-orm/postgresql';

import { Workspace } from '../entities/workspace.entity';
import { OnboardingStatus } from '../enums';

export interface UpsertWorkspaceInput {
  name: string;
  timezone?: string;
  defaultCurrency?: string;
}

export class WorkspaceRepository {
  constructor(private readonly em: EntityManager) {}

  async get(): Promise<Workspace | null> {
    return this.em.findOne(Workspace, { singleton: true });
  }

  async getOrCreate(initial: UpsertWorkspaceInput): Promise<Workspace> {
    const em = this.em.fork();
    const existing = await em.findOne(Workspace, { singleton: true });
    if (existing) return existing;
    const ws = em.create(
      Workspace,
      {
        name: initial.name,
        timezone: initial.timezone ?? 'UTC',
        defaultCurrency: initial.defaultCurrency ?? 'USD',
      },
      { partial: true },
    );
    await em.persistAndFlush(ws);
    return ws;
  }

  async update(patch: Partial<UpsertWorkspaceInput>): Promise<Workspace> {
    const em = this.em.fork();
    const ws = await em.findOneOrFail(Workspace, { singleton: true });
    if (patch.name !== undefined) ws.name = patch.name;
    if (patch.timezone !== undefined) ws.timezone = patch.timezone;
    if (patch.defaultCurrency !== undefined) ws.defaultCurrency = patch.defaultCurrency;
    await em.flush();
    return ws;
  }

  async advanceStatus(from: OnboardingStatus, to: OnboardingStatus): Promise<Workspace> {
    const em = this.em.fork();
    const ws = await em.findOneOrFail(Workspace, { singleton: true });
    if (ws.onboardingStatus !== from) {
      throw new Error(
        `Cannot advance onboarding from ${ws.onboardingStatus} → ${to}; expected current state ${from}`,
      );
    }
    ws.onboardingStatus = to;
    await em.flush();
    return ws;
  }

  async setStatus(status: OnboardingStatus): Promise<Workspace> {
    const em = this.em.fork();
    const ws = await em.findOneOrFail(Workspace, { singleton: true });
    ws.onboardingStatus = status;
    await em.flush();
    return ws;
  }

  async deleteAll(): Promise<void> {
    const em = this.em.fork();
    const rows = await em.find(Workspace, {});
    for (const row of rows) em.remove(row);
    await em.flush();
  }
}
