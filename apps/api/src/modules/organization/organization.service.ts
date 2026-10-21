import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OnboardingStatus,
  Organization,
  OrganizationsRepository,
  slugify,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from '@hothotleads/db';

export type NewOrganizationInput = Omit<CreateOrganizationInput, 'slug'> & { slug?: string };

@Injectable()
export class OrganizationService {
  constructor(private readonly orgsRepo: OrganizationsRepository) {}

  async get(id: string): Promise<Organization | null> {
    return this.orgsRepo.findById(id);
  }

  async getRequired(id: string): Promise<Organization> {
    const org = await this.orgsRepo.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async list(): Promise<Organization[]> {
    return this.orgsRepo.list();
  }

  async create(input: NewOrganizationInput): Promise<Organization> {
    const slug = await this.uniqueSlug(input.slug ?? input.name);
    try {
      return await this.orgsRepo.create({ ...input, slug });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException(`An organization with slug "${slug}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, patch: UpdateOrganizationInput): Promise<Organization> {
    const next = patch.slug !== undefined ? { ...patch, slug: slugify(patch.slug) } : patch;
    try {
      return await this.orgsRepo.update(id, next);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException(`An organization with slug "${next.slug}" already exists`);
      }
      throw err;
    }
  }

  async advanceStatus(id: string, from: OnboardingStatus, to: OnboardingStatus): Promise<Organization> {
    return this.orgsRepo.advanceStatus(id, from, to);
  }

  async setStatus(id: string, status: OnboardingStatus): Promise<Organization> {
    return this.orgsRepo.setStatus(id, status);
  }

  /** Derive a slug from a name and suffix it until it is free. */
  private async uniqueSlug(source: string): Promise<string> {
    const base = slugify(source) || 'org';
    let candidate = base;
    for (let i = 2; await this.orgsRepo.findBySlug(candidate); i += 1) {
      candidate = `${base}-${i}`;
    }
    return candidate;
  }
}
