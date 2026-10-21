import type { Schedule, SchedulesRepository } from '@hothotleads/db';

// The orchestrator pulls in the Claude Agent SDK (ESM); the scheduler never calls it here.
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({ createSdkMcpServer: jest.fn(), query: jest.fn(), tool: jest.fn() }));

import { SchedulerService } from './scheduler.service';
import type { OrchestratorAgent } from '../agents/orchestrator/orchestrator.agent';
import type { TelegramService } from '../channels/telegram/telegram.service';
import type { WhatsAppService } from '../channels/whatsapp/whatsapp.service';
import type { TenantContextService } from '../modules/auth/tenant-context.service';
import { DEFAULT_ENTITLEMENTS } from '@hothotleads/types';

function harness(ctx: unknown) {
  const schedule = {
    id: 'sch1',
    name: 'Daily',
    taskPrompt: 'do it',
    channel: 'telegram',
    chatId: 'chat',
    organization: { id: 'o1' },
  } as unknown as Schedule;
  const repo = {
    findForOrg: jest.fn(async () => schedule),
    disableSchedule: jest.fn(async () => undefined),
    markLastRun: jest.fn(async () => undefined),
  } as unknown as SchedulesRepository;
  const orchestrator = { run: jest.fn(async () => 'done') } as unknown as OrchestratorAgent;
  const telegram = { send: jest.fn(async () => undefined) } as unknown as TelegramService;
  const whatsapp = { send: jest.fn(async () => undefined) } as unknown as WhatsAppService;
  const tenant = { forSchedule: jest.fn(async () => ctx) } as unknown as TenantContextService;
  const registry = { deleteCronJob: jest.fn(), addCronJob: jest.fn() };
  const svc = new SchedulerService({} as never, registry as never, repo, orchestrator, telegram, whatsapp, tenant);
  const run = () => (svc as unknown as { runScheduleInContext: (s: Schedule) => Promise<void> }).runScheduleInContext(schedule);
  return { run, repo, orchestrator, telegram, registry };
}

const orgCtx = (overrides: Partial<typeof DEFAULT_ENTITLEMENTS> = {}) => ({
  org: { id: 'o1', name: 'Acme' },
  user: { id: 'u1' },
  role: 'owner',
  entitlements: { ...DEFAULT_ENTITLEMENTS, ...overrides },
});

describe('SchedulerService.runScheduleInContext', () => {
  it('disables the schedule when no context can be rebuilt', async () => {
    const h = harness(null);
    await h.run();
    expect(h.repo.disableSchedule).toHaveBeenCalledWith('sch1');
    expect(h.registry.deleteCronJob).toHaveBeenCalledWith('schedule_sch1');
    expect(h.orchestrator.run).not.toHaveBeenCalled();
  });

  it('skips when the organization has schedules disabled', async () => {
    const h = harness(orgCtx({ features: { ...DEFAULT_ENTITLEMENTS.features, schedules: false } }));
    await h.run();
    expect(h.orchestrator.run).not.toHaveBeenCalled();
    expect(h.repo.disableSchedule).not.toHaveBeenCalled();
  });

  it('skips when the delivery channel is not entitled', async () => {
    const h = harness(orgCtx({ channels: ['whatsapp'] }));
    await h.run();
    expect(h.orchestrator.run).not.toHaveBeenCalled();
  });

  it('runs with the rebuilt context, delivers and marks the run', async () => {
    const h = harness(orgCtx());
    await h.run();
    expect(h.orchestrator.run).toHaveBeenCalledWith('do it', expect.objectContaining({ ctx: expect.objectContaining({ org: { id: 'o1', name: 'Acme' } }) }));
    expect(h.telegram.send).toHaveBeenCalledWith({ chatId: 'chat', text: 'done' });
    expect(h.repo.markLastRun).toHaveBeenCalledWith('sch1');
  });
});
