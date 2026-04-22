import type { ChatReply, Feedback, Lead, Outreach, Product, Signal } from './types';

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
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
  chat: async (text: string, userId = 'web-demo'): Promise<ChatReply> => {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, userId }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(msg || 'Chat request failed');
    }
    return (await res.json()) as ChatReply;
  },
};
