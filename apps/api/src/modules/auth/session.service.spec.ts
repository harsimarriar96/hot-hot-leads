import type { Session, SessionsRepository } from '@hothotleads/db';

import { SESSION_TOUCH_INTERVAL_MS, SESSION_TTL_MS, SessionService } from './session.service';
import { hashToken } from './token.util';

function makeRepo(session: Partial<Session> | null) {
  const calls: Record<string, unknown[]> = { touch: [], remove: [] };
  const repo = {
    findByTokenHash: jest.fn(async () => session as Session | null),
    touch: jest.fn(async (...args: unknown[]) => void calls.touch.push(args)),
    remove: jest.fn(async (...args: unknown[]) => void calls.remove.push(args)),
    create: jest.fn(async (input: { tokenHash: string }) => ({ id: 's1', ...input }) as unknown as Session),
    removeAllForUser: jest.fn(async () => 0),
    setActiveOrganization: jest.fn(async () => undefined),
    purgeExpired: jest.fn(async () => 0),
  };
  return { repo: repo as unknown as SessionsRepository, mocks: repo };
}

describe('SessionService.resolve', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  it('returns null for an unknown token', async () => {
    const { repo } = makeRepo(null);
    expect(await new SessionService(repo).resolve('nope', now)).toBeNull();
  });

  it('deletes and rejects an expired session', async () => {
    const { repo, mocks } = makeRepo({ id: 's1', expiresAt: new Date(now.getTime() - 1), lastSeenAt: now });
    expect(await new SessionService(repo).resolve('t', now)).toBeNull();
    expect(mocks.remove).toHaveBeenCalledWith('s1');
  });

  it('slides the expiry only when last seen more than an hour ago', async () => {
    const fresh = makeRepo({ id: 's1', expiresAt: new Date(now.getTime() + 1000), lastSeenAt: new Date(now.getTime() - 60_000) });
    expect(await new SessionService(fresh.repo).resolve('t', now)).not.toBeNull();
    expect(fresh.mocks.touch).not.toHaveBeenCalled();

    const stale = makeRepo({
      id: 's1',
      expiresAt: new Date(now.getTime() + 1000),
      lastSeenAt: new Date(now.getTime() - SESSION_TOUCH_INTERVAL_MS - 1),
    });
    expect(await new SessionService(stale.repo).resolve('t', now)).not.toBeNull();
    expect(stale.mocks.touch).toHaveBeenCalledWith('s1', now, new Date(now.getTime() + SESSION_TTL_MS));
  });

  it('issues a token and stores only its hash', async () => {
    const { repo, mocks } = makeRepo(null);
    const { token } = await new SessionService(repo).issue('u1');
    const stored = (mocks.create.mock.calls[0] as unknown as [{ tokenHash: string; userId: string }])[0];
    expect(stored.userId).toBe('u1');
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(stored.tokenHash).not.toBe(token);
  });
});
