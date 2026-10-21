import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthTokenKind, type AuthToken } from '@hothotleads/db';

import { InvitationService } from './invitation.service';
import { hashToken } from './token.util';

/** In-memory stand-ins for the repositories the service touches. */
function harness(opts: { maxMembers?: number; existingUser?: { id: string; passwordHash?: string } | null } = {}) {
  const org = { id: 'o1', name: 'Acme', entitlements: { limits: { maxMembers: opts.maxMembers ?? 25 } } };
  const tokens: AuthToken[] = [];
  const memberships = new Set<string>();
  const users = new Map<string, { id: string; email: string; passwordHash?: string }>();
  if (opts.existingUser) users.set('bob@acme.io', { email: 'bob@acme.io', ...opts.existingUser });

  const tokensRepo = {
    create: jest.fn(async (input: Record<string, unknown>) => {
      const row = { id: `t${tokens.length + 1}`, usedAt: undefined, organization: org, createdAt: new Date(), ...input } as unknown as AuthToken;
      tokens.push(row);
      return row;
    }),
    findValidByHash: jest.fn(async (kind: AuthTokenKind, hash: string) =>
      tokens.find((t) => t.kind === kind && t.tokenHash === hash && !t.usedAt && t.expiresAt > new Date()) ?? null),
    findById: jest.fn(async (id: string) => tokens.find((t) => t.id === id) ?? null),
    markUsed: jest.fn(async (id: string) => {
      const t = tokens.find((x) => x.id === id);
      if (t) t.usedAt = new Date();
    }),
    supersedePending: jest.fn(async (kind: AuthTokenKind, email: string) => {
      tokens.filter((t) => t.kind === kind && t.email === email && !t.usedAt).forEach((t) => (t.expiresAt = new Date(0)));
      return 0;
    }),
    listPendingInvites: jest.fn(async () => tokens.filter((t) => t.kind === AuthTokenKind.INVITE && !t.usedAt && t.expiresAt > new Date())),
    revokeInvite: jest.fn(async () => true),
  };
  const usersRepo = {
    findByEmail: jest.fn(async (email: string) => users.get(email.toLowerCase()) ?? null),
    create: jest.fn(async (input: { email: string }) => {
      const u = { id: 'new', ...input };
      users.set(input.email, u);
      return u;
    }),
    setPasswordHash: jest.fn(async () => undefined),
    updateProfile: jest.fn(async () => undefined),
    touchLastLogin: jest.fn(async () => undefined),
  };
  const membershipsRepo = {
    find: jest.fn(async (userId: string) => (memberships.has(userId) ? { role: 'member' } : null)),
    create: jest.fn(async (userId: string) => void memberships.add(userId)),
    countForOrg: jest.fn(async () => memberships.size + 1),
  };
  const orgsRepo = { findById: jest.fn(async () => org) };
  const passwords = { hash: jest.fn(async (p: string) => `hashed:${p}`) };
  const sessions = { issue: jest.fn(async () => ({ token: 'session-token', session: { id: 's' } })) };
  const config = { get: (k: string) => (k === 'app.publicUrl' ? 'https://app.test' : undefined) } as unknown as ConfigService;

  const svc = new InvitationService(
    config,
    tokensRepo as never,
    usersRepo as never,
    membershipsRepo as never,
    orgsRepo as never,
    passwords as never,
    sessions as never,
  );
  return { svc, tokens, memberships, usersRepo, membershipsRepo };
}

const rawFrom = (inviteUrl?: string) => decodeURIComponent(inviteUrl!.split('token=')[1]);

describe('InvitationService', () => {
  it('creates an invite whose stored token is a hash and whose link points at the web app', async () => {
    const { svc, tokens } = harness();
    const inv = await svc.create('o1', 'Bob@Acme.io', 'viewer', 'u-admin');
    expect(inv.email).toBe('bob@acme.io');
    expect(inv.inviteUrl).toMatch(/^https:\/\/app\.test\/accept-invite\?token=/);
    expect(tokens[0].tokenHash).toBe(hashToken(rawFrom(inv.inviteUrl)));
  });

  it('supersedes an earlier pending invite for the same email', async () => {
    const { svc } = harness();
    const first = await svc.create('o1', 'bob@acme.io', 'viewer', null);
    await svc.create('o1', 'bob@acme.io', 'member', null);
    await expect(svc.describe(rawFrom(first.inviteUrl))).rejects.toThrow(BadRequestException);
  });

  it('refuses to invite an existing member', async () => {
    const { svc, memberships } = harness({ existingUser: { id: 'bob' } });
    memberships.add('bob');
    await expect(svc.create('o1', 'bob@acme.io', 'viewer', null)).rejects.toThrow(ConflictException);
  });

  it('enforces maxMembers counting pending invites', async () => {
    const { svc } = harness({ maxMembers: 2 });
    await svc.create('o1', 'one@acme.io', 'viewer', null); // 1 member + 1 pending = 2
    await expect(svc.create('o1', 'two@acme.io', 'viewer', null)).rejects.toThrow(ForbiddenException);
  });

  it('signs a new user in after they set a name and password', async () => {
    const { svc, usersRepo, membershipsRepo } = harness();
    const inv = await svc.create('o1', 'bob@acme.io', 'member', null);
    await expect(svc.accept(rawFrom(inv.inviteUrl), {}, {})).rejects.toThrow(BadRequestException);
    const result = await svc.accept(rawFrom(inv.inviteUrl), { name: 'Bob', password: 'long-enough-pw' }, {});
    expect(result).toMatchObject({ kind: 'signed_in', token: 'session-token', organizationId: 'o1' });
    expect(usersRepo.create).toHaveBeenCalled();
    expect(membershipsRepo.create).toHaveBeenCalledWith('new', 'o1', 'member');
  });

  it('only adds the membership for an existing account and never issues a session', async () => {
    const { svc, membershipsRepo } = harness({ existingUser: { id: 'bob', passwordHash: 'x' } });
    const inv = await svc.create('o1', 'bob@acme.io', 'admin', null);
    const result = await svc.accept(rawFrom(inv.inviteUrl), {}, {});
    expect(result.kind).toBe('requires_login');
    expect(membershipsRepo.create).toHaveBeenCalledWith('bob', 'o1', 'admin');
    await expect(svc.accept(rawFrom(inv.inviteUrl), {}, {})).rejects.toThrow(BadRequestException); // single use
  });
});
