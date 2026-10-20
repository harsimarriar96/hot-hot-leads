import { apiJson, postJson } from './http';
import type { ChatReply, Feedback, Lead, Outreach, Product, Signal } from './types';

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
  signals: (product: string, days = 14) =>
    getJSON<Signal[]>(`/api/signals?product=${encodeURIComponent(product)}&days=${days}`),
  outreach: (product: string) =>
    getJSON<Outreach[]>(`/api/outreach?product=${encodeURIComponent(product)}`),
  feedback: (product: string) =>
    getJSON<Feedback[]>(`/api/feedback?product=${encodeURIComponent(product)}`),
  chat: (text: string, userId = 'web-demo') => postJson<ChatReply>('/api/chat', { text, userId }),
};
