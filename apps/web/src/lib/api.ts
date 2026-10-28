import { apiJson } from './http';
import type { Feedback, Lead, Outreach, Product, Signal } from './types';

async function getJSON<T>(url: string): Promise<T> {
  const data = await apiJson<T>(url);
  // The reports endpoints answer 200 with { error } when the product param is missing.
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data;
}

export const api = {
  products: () => getJSON<Product[]>('/api/products'),
  leads: (product: string) =>
    getJSON<Lead[]>(`/api/leads?product=${encodeURIComponent(product)}`),
  /** `review` asks for the server's review queue (pending, or snoozed and due), ignoring `days` and `status`. */
  signals: (product: string, days = 14, status?: string[], review?: boolean) =>
    getJSON<Signal[]>(
      `/api/signals?product=${encodeURIComponent(product)}&days=${days}${
        status && status.length > 0 ? `&status=${status.map(encodeURIComponent).join(',')}` : ''
      }${review ? '&review=1' : ''}`,
    ),
  outreach: (product: string) =>
    getJSON<Outreach[]>(`/api/outreach?product=${encodeURIComponent(product)}`),
  feedback: (product: string) =>
    getJSON<Feedback[]>(`/api/feedback?product=${encodeURIComponent(product)}`),
};
