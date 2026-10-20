import { apiJson as jsonOrThrow } from './http';

export interface ScheduleRow {
  id: string;
  name: string;
  taskPrompt: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'custom';
  cronExpression: string | null;
  channel: 'telegram' | 'whatsapp';
  chatId: string;
  userId: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  productName: string | null;
  productId: string | null;
  createdAt: string;
}

export const schedulesApi = {
  list: () => jsonOrThrow<ScheduleRow[]>('/api/schedules'),
  setEnabled: (id: string, enabled: boolean) =>
    jsonOrThrow<{ id: string; enabled: boolean }>(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }),
  runNow: (id: string) =>
    jsonOrThrow<{ id: string; status: string }>(`/api/schedules/${id}/run`, {
      method: 'POST',
    }),
};
