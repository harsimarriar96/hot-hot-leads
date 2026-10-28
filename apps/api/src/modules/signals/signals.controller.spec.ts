import { NotFoundException } from '@nestjs/common';
import { SignalStatus, type SignalsRepository } from '@hothotleads/db';
import { DEFAULT_ENTITLEMENTS } from '@hothotleads/types';

import type { TenantContext } from '../auth/tenant-context';
import { SignalsController } from './signals.controller';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-10-01T00:00:00.000Z');

function ctx(): TenantContext {
  return {
    user: { id: 'user-1', email: 'a@b.c', name: 'Ann', isPlatformAdmin: false, preferredChannel: null },
    org: { id: 'org-1', name: 'Acme', slug: 'acme', plan: 'standard', timezone: 'UTC', defaultCurrency: 'USD', onboardingStatus: 'completed', syncChannelChats: true },
    membership: { id: 'm1', role: 'member' },
    role: 'member',
    permissions: new Set(['signals:write']),
    entitlements: { ...DEFAULT_ENTITLEMENTS },
    actor: 'user',
  } as unknown as TenantContext;
}

function harness(found = true) {
  const reviewSignal = jest.fn(async (_org: string, id: string, input: { status: SignalStatus; snoozedUntil?: Date }) =>
    found
      ? {
          id,
          product: { id: 'p1' },
          type: 'funding',
          description: 'Raised',
          detectedAt: T0,
          createdAt: T0,
          status: input.status,
          reviewedAt: T0,
          snoozedUntil: input.snoozedUntil,
        }
      : null,
  );
  const controller = new SignalsController({ reviewSignal } as unknown as SignalsRepository);
  return { controller, reviewSignal };
}

describe('SignalsController.review', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(T0));
  afterEach(() => jest.useRealTimers());

  it('maps approve to the approved status without a snooze window', async () => {
    const h = harness();
    const out = await h.controller.review(ctx(), 'sig-1', { action: 'approve' });
    expect(h.reviewSignal).toHaveBeenCalledWith('org-1', 'sig-1', { status: SignalStatus.APPROVED, userId: 'user-1', snoozedUntil: undefined });
    expect(out.status).toBe('approved');
    expect(out.snoozedUntil).toBeNull();
    expect(out.reviewedAt).toBe(T0.toISOString());
  });

  it('maps reject to the rejected status', async () => {
    const h = harness();
    const out = await h.controller.review(ctx(), 'sig-1', { action: 'reject' });
    expect(h.reviewSignal).toHaveBeenCalledWith('org-1', 'sig-1', expect.objectContaining({ status: SignalStatus.REJECTED, snoozedUntil: undefined }));
    expect(out.status).toBe('rejected');
  });

  it('snoozes for 7 days by default', async () => {
    const h = harness();
    const out = await h.controller.review(ctx(), 'sig-1', { action: 'snooze' });
    expect(h.reviewSignal).toHaveBeenCalledWith('org-1', 'sig-1', expect.objectContaining({ status: SignalStatus.SNOOZED, snoozedUntil: new Date(T0.getTime() + 7 * DAY) }));
    expect(out.snoozedUntil).toBe(new Date(T0.getTime() + 7 * DAY).toISOString());
  });

  it('honours a custom snooze window', async () => {
    const h = harness();
    await h.controller.review(ctx(), 'sig-1', { action: 'snooze', snoozeDays: 30 });
    expect(h.reviewSignal).toHaveBeenCalledWith('org-1', 'sig-1', expect.objectContaining({ snoozedUntil: new Date(T0.getTime() + 30 * DAY) }));
  });

  it('returns 404 when the repository finds nothing (foreign tenant or unknown id)', async () => {
    const h = harness(false);
    await expect(h.controller.review(ctx(), 'nope', { action: 'approve' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
