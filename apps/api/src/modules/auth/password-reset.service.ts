import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthTokenKind, AuthTokensRepository, UsersRepository } from '@hothotleads/db';

import { resetUrl } from './links';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { generateToken, hashToken } from './token.util';

export const RESET_TTL_MS = 72 * 60 * 60 * 1000;

export interface ResetLink {
  resetUrl: string;
  expiresAt: string;
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly config: ConfigService,
    private readonly tokensRepo: AuthTokensRepository,
    private readonly usersRepo: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  /** A one-time link an admin hands to the user. Replaces any pending link for that account. */
  async createLink(userId: string, ttlMs = RESET_TTL_MS): Promise<ResetLink> {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    await this.tokensRepo.supersedePending(AuthTokenKind.PASSWORD_RESET, user.email);
    const token = generateToken();
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.tokensRepo.create({
      kind: AuthTokenKind.PASSWORD_RESET,
      tokenHash: hashToken(token),
      email: user.email,
      userId: user.id,
      expiresAt,
    });
    return { resetUrl: resetUrl(this.config, token), expiresAt: expiresAt.toISOString() };
  }

  async hasPendingLink(email: string): Promise<boolean> {
    return (await this.tokensRepo.countPending(AuthTokenKind.PASSWORD_RESET, email)) > 0;
  }

  /** Consume a reset link: set the password and sign the user out everywhere. */
  async reset(rawToken: string, newPassword: string): Promise<void> {
    const row = await this.tokensRepo.findValidByHash(AuthTokenKind.PASSWORD_RESET, hashToken(rawToken));
    if (!row || !row.user) {
      throw new BadRequestException({ code: 'invalid_or_expired_token', message: 'This reset link is invalid or has expired' });
    }
    await this.usersRepo.setPasswordHash(row.user.id, await this.passwords.hash(newPassword));
    await this.tokensRepo.markUsed(row.id);
    await this.sessions.revokeAllForUser(row.user.id);
  }

  /** Signed-in change. A wrong current password is a 400, never a 401, so the web stays signed in. */
  async change(userId: string, currentPassword: string, newPassword: string, keepSessionId: string): Promise<void> {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!(await this.passwords.verify(currentPassword, user.passwordHash))) {
      throw new BadRequestException({ code: 'invalid_password', message: 'Current password is incorrect' });
    }
    await this.usersRepo.setPasswordHash(user.id, await this.passwords.hash(newPassword));
    await this.sessions.revokeAllForUser(user.id, keepSessionId);
  }
}
