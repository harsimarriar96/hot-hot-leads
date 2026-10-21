import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthToken,
  AuthTokenKind,
  AuthTokensRepository,
  MembershipRole,
  MembershipsRepository,
  OrganizationsRepository,
  UsersRepository,
  normalizeEmail,
} from '@hothotleads/db';
import { resolveEntitlements, type Invitation, type Role } from '@hothotleads/types';

import { inviteUrl } from './links';
import { PasswordService } from './password.service';
import { SessionService, type IssueSessionInput } from './session.service';
import { denial } from './tenant-context';
import { generateToken, hashToken } from './token.util';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface InvitationDescription {
  email: string;
  organization: { id: string; name: string };
  role: Role;
  invitedBy: string | null;
  existingUser: boolean;
}

export type AcceptResult =
  | { kind: 'signed_in'; token: string; userId: string; organizationId: string }
  | { kind: 'requires_login'; email: string; organization: { id: string; name: string } };

@Injectable()
export class InvitationService {
  constructor(
    private readonly config: ConfigService,
    private readonly tokensRepo: AuthTokensRepository,
    private readonly usersRepo: UsersRepository,
    private readonly membershipsRepo: MembershipsRepository,
    private readonly orgsRepo: OrganizationsRepository,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  /** Create (or replace) a pending invitation. The link is only ever returned here and from `regenerateLink`. */
  async create(orgId: string, rawEmail: string, role: Role, invitedByUserId: string | null): Promise<Invitation> {
    const email = normalizeEmail(rawEmail);
    const org = await this.orgsRepo.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');

    const existingUser = await this.usersRepo.findByEmail(email);
    if (existingUser && (await this.membershipsRepo.find(existingUser.id, orgId))) {
      throw new ConflictException(`${email} is already a member of this organization`);
    }

    const { maxMembers } = resolveEntitlements(org.entitlements).limits;
    const members = await this.membershipsRepo.countForOrg(orgId);
    const pending = (await this.tokensRepo.listPendingInvites(orgId)).filter((t) => t.email !== email);
    if (members + pending.length >= maxMembers) {
      throw denial({
        code: 'limit_reached',
        message: `This organization is limited to ${maxMembers} members`,
        limit: 'maxMembers',
      });
    }

    await this.tokensRepo.supersedePending(AuthTokenKind.INVITE, email, orgId);
    const token = generateToken();
    const row = await this.tokensRepo.create({
      kind: AuthTokenKind.INVITE,
      tokenHash: hashToken(token),
      email,
      organizationId: orgId,
      role: role as MembershipRole,
      invitedByUserId: invitedByUserId ?? undefined,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    return this.toView(row, inviteUrl(this.config, token));
  }

  async listPending(orgId: string): Promise<Invitation[]> {
    const rows = await this.tokensRepo.listPendingInvites(orgId);
    return rows.map((r) => this.toView(r));
  }

  /** Issue a fresh link for a pending invitation (the stored token is only a hash). */
  async regenerateLink(orgId: string, id: string, requestedByUserId: string | null): Promise<Invitation> {
    const row = await this.tokensRepo.findById(id);
    if (!row || row.kind !== AuthTokenKind.INVITE || row.organization?.id !== orgId || row.usedAt) {
      throw new NotFoundException('Invitation not found');
    }
    return this.create(orgId, row.email, (row.role ?? MembershipRole.MEMBER) as Role, requestedByUserId);
  }

  async revoke(orgId: string, id: string): Promise<void> {
    const removed = await this.tokensRepo.revokeInvite(orgId, id);
    if (!removed) throw new NotFoundException('Invitation not found');
  }

  /** Public: what the accept page needs to render the right form. */
  async describe(rawToken: string): Promise<InvitationDescription> {
    const row = await this.requireValid(rawToken);
    const existingUser = await this.usersRepo.findByEmail(row.email);
    return {
      email: row.email,
      organization: { id: row.organization!.id, name: row.organization!.name },
      role: (row.role ?? MembershipRole.MEMBER) as Role,
      invitedBy: row.invitedBy?.name ?? null,
      existingUser: Boolean(existingUser?.passwordHash),
    };
  }

  /**
   * Accept an invitation. A brand-new (or passwordless) account sets name + password and is
   * signed in. An existing account only gains the membership and must sign in normally:
   * possession of an invite link must never log someone into an existing account.
   */
  async accept(
    rawToken: string,
    input: { name?: string; password?: string },
    sessionMeta: IssueSessionInput,
  ): Promise<AcceptResult> {
    const row = await this.requireValid(rawToken);
    const org = row.organization!;
    const role = (row.role ?? MembershipRole.MEMBER) as MembershipRole;

    let user = await this.usersRepo.findByEmail(row.email);
    const needsCredentials = !user || !user.passwordHash;

    if (needsCredentials) {
      if (!input.password) throw new BadRequestException('A password is required to create your account');
      const passwordHash = await this.passwords.hash(input.password);
      if (!user) {
        if (!input.name) throw new BadRequestException('A name is required to create your account');
        user = await this.usersRepo.create({ email: row.email, name: input.name, passwordHash });
      } else {
        await this.usersRepo.setPasswordHash(user.id, passwordHash);
        if (input.name) await this.usersRepo.updateProfile(user.id, { name: input.name });
      }
    }

    if (!(await this.membershipsRepo.find(user!.id, org.id))) {
      await this.membershipsRepo.create(user!.id, org.id, role);
    }
    await this.tokensRepo.markUsed(row.id);

    if (!needsCredentials) {
      return { kind: 'requires_login', email: row.email, organization: { id: org.id, name: org.name } };
    }
    await this.usersRepo.touchLastLogin(user!.id);
    const { token } = await this.sessions.issue(user!.id, { ...sessionMeta, activeOrganizationId: org.id });
    return { kind: 'signed_in', token, userId: user!.id, organizationId: org.id };
  }

  private async requireValid(rawToken: string): Promise<AuthToken> {
    const row = await this.tokensRepo.findValidByHash(AuthTokenKind.INVITE, hashToken(rawToken));
    if (!row || !row.organization) {
      throw new BadRequestException({ code: 'invalid_or_expired_token', message: 'This invitation link is invalid or has expired' });
    }
    return row;
  }

  private toView(row: AuthToken, url?: string): Invitation {
    return {
      id: row.id,
      email: row.email,
      role: (row.role ?? MembershipRole.MEMBER) as Role,
      invitedBy: row.invitedBy?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      inviteUrl: url,
    };
  }
}
