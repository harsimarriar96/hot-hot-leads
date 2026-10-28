import type { DashboardOverview } from '@hothotleads/types';
import { apiJson, postJson } from './http';
import type { Signal } from './types';

export type SignalReviewAction = 'approve' | 'reject' | 'snooze';

export const dashboardApi = {
  overview: () => apiJson<DashboardOverview>('/api/dashboard/overview'),
};

export const signalsApi = {
  review: (id: string, action: SignalReviewAction, snoozeDays?: number) =>
    postJson<Signal>(
      `/api/signals/${encodeURIComponent(id)}/review`,
      snoozeDays == null ? { action } : { action, snoozeDays },
    ),
};
