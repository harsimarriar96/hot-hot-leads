import { EntityManager } from '@mikro-orm/postgresql';

import { User } from '../entities/user.entity';
import { PreferredChannel } from '../enums';

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash?: string;
  isPlatformAdmin?: boolean;
  preferredChannel?: PreferredChannel;
}

export interface UpdateUserProfileInput {
  name?: string;
  email?: string;
  preferredChannel?: PreferredChannel | null;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export class UsersRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<User | null> {
    return this.em.fork().findOne(User, { id });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.em.fork().findOne(User, { email: normalizeEmail(email) });
  }

  async list(): Promise<User[]> {
    return this.em.fork().find(User, {}, { orderBy: { createdAt: 'ASC' } });
  }

  async count(): Promise<number> {
    return this.em.fork().count(User, {});
  }

  /** Users who have at least one membership but no password yet (migrated operators, pending invitees). */
  async listWithoutPassword(): Promise<User[]> {
    const em = this.em.fork();
    return em.find(User, { passwordHash: null });
  }

  async create(input: CreateUserInput): Promise<User> {
    const em = this.em.fork();
    const user = em.create(
      User,
      {
        email: normalizeEmail(input.email),
        name: input.name,
        passwordHash: input.passwordHash,
        isPlatformAdmin: input.isPlatformAdmin ?? false,
        preferredChannel: input.preferredChannel,
      },
      { partial: true },
    );
    await em.persistAndFlush(user);
    return user;
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    const em = this.em.fork();
    const user = await em.findOneOrFail(User, { id });
    user.passwordHash = passwordHash;
    await em.flush();
  }

  async setPlatformAdmin(id: string, isPlatformAdmin: boolean): Promise<void> {
    const em = this.em.fork();
    const user = await em.findOneOrFail(User, { id });
    user.isPlatformAdmin = isPlatformAdmin;
    await em.flush();
  }

  async updateProfile(id: string, patch: UpdateUserProfileInput): Promise<User> {
    const em = this.em.fork();
    const user = await em.findOneOrFail(User, { id });
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.email !== undefined) user.email = normalizeEmail(patch.email);
    if (patch.preferredChannel !== undefined) user.preferredChannel = patch.preferredChannel ?? undefined;
    await em.flush();
    return user;
  }

  async touchLastLogin(id: string): Promise<void> {
    const em = this.em.fork();
    const user = await em.findOne(User, { id });
    if (!user) return;
    user.lastLoginAt = new Date();
    await em.flush();
  }
}
