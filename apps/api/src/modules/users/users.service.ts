import { ConflictException, Injectable } from '@nestjs/common';
import {
  MembershipRole,
  MembershipsRepository,
  PreferredChannel,
  User,
  UsersRepository,
  type UpdateUserProfileInput,
} from '@hothotleads/db';

export interface UpsertOwnerInput {
  name: string;
  email: string;
  preferredChannel?: PreferredChannel;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly membershipsRepo: MembershipsRepository,
  ) {}

  async getById(id: string): Promise<User | null> {
    return this.usersRepo.findById(id);
  }

  /** The organization's earliest owner, if any. */
  async getOwnerForOrg(orgId: string): Promise<User | null> {
    const owner = await this.membershipsRepo.firstOwner(orgId);
    return owner?.user ?? null;
  }

  /** Create or update the user with this email and make sure they own the organization. */
  async upsertOwner(orgId: string, input: UpsertOwnerInput): Promise<User> {
    let user = await this.usersRepo.findByEmail(input.email);
    if (user) {
      user = await this.updateProfile(user.id, {
        name: input.name,
        preferredChannel: input.preferredChannel ?? null,
      });
    } else {
      user = await this.usersRepo.create({
        email: input.email,
        name: input.name,
        preferredChannel: input.preferredChannel,
      });
    }
    const membership = await this.membershipsRepo.find(user.id, orgId);
    if (!membership) {
      await this.membershipsRepo.create(user.id, orgId, MembershipRole.OWNER);
    } else if (membership.role !== MembershipRole.OWNER) {
      await this.membershipsRepo.updateRole(user.id, orgId, MembershipRole.OWNER);
    }
    return user;
  }

  async updateProfile(userId: string, patch: UpdateUserProfileInput): Promise<User> {
    try {
      return await this.usersRepo.updateProfile(userId, patch);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException('A user with that email already exists');
      }
      throw err;
    }
  }
}
