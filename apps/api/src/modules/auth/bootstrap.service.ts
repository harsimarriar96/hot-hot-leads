import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipsRepository, UsersRepository } from '@hothotleads/db';

import { PasswordResetService } from './password-reset.service';
import { PasswordService } from './password.service';

/**
 * First-boot and upgrade safety:
 *  - PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD create (or promote) the platform admin.
 *    The password is only applied to an account that has none, so the env var never
 *    silently resets a password that was changed in the app.
 *  - Every member without a password (an operator migrated from the single-tenant era, or
 *    a pending invitee) gets a reset link printed to the log so they can get in.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usersRepo: UsersRepository,
    private readonly membershipsRepo: MembershipsRepository,
    private readonly passwords: PasswordService,
    private readonly resets: PasswordResetService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensurePlatformAdmin();
    await this.announceResetLinks();
  }

  private async ensurePlatformAdmin(): Promise<void> {
    const email = this.config.get<string>('platformAdmin.email');
    const password = this.config.get<string>('platformAdmin.password');
    if (!email || !password) {
      if ((await this.usersRepo.count()) === 0) {
        throw new Error(
          'No users exist and PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD are not set. ' +
            'Set both so the first platform admin can sign in.',
        );
      }
      return;
    }
    const existing = await this.usersRepo.findByEmail(email);
    if (!existing) {
      await this.usersRepo.create({
        email,
        name: 'Platform admin',
        isPlatformAdmin: true,
        passwordHash: await this.passwords.hash(password),
      });
      this.logger.log(`Created platform admin ${email}`);
      return;
    }
    if (!existing.isPlatformAdmin) {
      await this.usersRepo.setPlatformAdmin(existing.id, true);
      this.logger.log(`Promoted ${email} to platform admin`);
    }
    if (!existing.passwordHash) {
      await this.usersRepo.setPasswordHash(existing.id, await this.passwords.hash(password));
      this.logger.log(`Set the initial password for ${email}`);
    }
  }

  private async announceResetLinks(): Promise<void> {
    for (const user of await this.usersRepo.listWithoutPassword()) {
      const memberships = await this.membershipsRepo.listForUser(user.id);
      if (memberships.length === 0) continue;
      if (await this.resets.hasPendingLink(user.email)) continue;
      const { resetUrl, expiresAt } = await this.resets.createLink(user.id);
      this.logger.warn(`User ${user.email} has no password yet. Set it via ${resetUrl} (valid until ${expiresAt})`);
    }
  }
}
