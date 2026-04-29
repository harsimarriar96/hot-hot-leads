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

async function jsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || `${res.status} ${res.statusText}`;
    throw new Error(Array.isArray(msg) ? msg.join('; ') : String(msg));
  }
  return body as T;
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
