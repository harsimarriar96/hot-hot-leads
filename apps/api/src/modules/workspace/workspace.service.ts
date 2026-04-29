import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OnboardingStatus, Workspace, WorkspaceRepository, type UpsertWorkspaceInput } from '@hothotleads/db';

@Injectable()
export class WorkspaceService {
  constructor(private readonly workspaceRepo: WorkspaceRepository) {}

  async get(): Promise<Workspace | null> {
    return this.workspaceRepo.get();
  }

  async getRequired(): Promise<Workspace> {
    const ws = await this.workspaceRepo.get();
    if (!ws) throw new NotFoundException('Workspace not found — run onboarding first');
    return ws;
  }

  /**
   * Create the workspace if it doesn't exist. If it does, update in place.
   * The singleton index prevents a second row at the DB level.
   */
  async createOrUpdate(input: UpsertWorkspaceInput): Promise<Workspace> {
    const existing = await this.workspaceRepo.get();
    if (existing) {
      return this.workspaceRepo.update(input);
    }
    try {
      return await this.workspaceRepo.getOrCreate(input);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException('A workspace already exists for this deployment');
      }
      throw err;
    }
  }

  async update(patch: Partial<UpsertWorkspaceInput>): Promise<Workspace> {
    return this.workspaceRepo.update(patch);
  }

  async advanceStatus(from: OnboardingStatus, to: OnboardingStatus): Promise<Workspace> {
    return this.workspaceRepo.advanceStatus(from, to);
  }

  async setStatus(status: OnboardingStatus): Promise<Workspace> {
    return this.workspaceRepo.setStatus(status);
  }

  async reset(): Promise<void> {
    await this.workspaceRepo.deleteAll();
  }
}
