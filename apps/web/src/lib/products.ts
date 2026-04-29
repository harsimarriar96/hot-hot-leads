export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  generalInfo: string;
  createdAt: string;
  updatedAt: string;
  leadCount: number;
  activeSignalCount: number;
  lastChatActivityAt: string | null;
}

export type AgentModelTier = 'fast' | 'default' | 'heavy';

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  generalInfo: string;
  salesStrategy: string;
  pricing: string;
  agentModelTier: AgentModelTier;
  agentExtraInstructions: string;
  icpStrictness: number;
  icp: {
    targetIndustries: string[];
    companySizes: string[];
    geographies: string[];
    fundingStages: string[];
    notes: string;
  } | null;
  salesChannels: Array<{ id: string; name: string; description: string; template: string | null }>;
  sources: Array<{ id: string; name: string; url: string; description: string; type: string }>;
  predefinedProspects: Array<{
    id: string;
    company: string;
    domain: string;
    industry: string;
    companySize: string;
    fundingStage: string;
    icpFitNotes: string;
  }>;
}

export interface ProductChatView {
  chat: { id: string; createdAt: string; updatedAt: string };
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'tool';
    contentBlocks: ChatContentBlock[];
    sourceChannel: 'web' | 'telegram' | 'whatsapp';
    sourceRef: string | null;
    createdAt: string;
  }>;
}

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string | Record<string, unknown>;
      is_error?: boolean;
    };

async function jsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      (body && (body.message || body.error)) || `${res.status} ${res.statusText}`;
    throw new Error(Array.isArray(msg) ? msg.join('; ') : String(msg));
  }
  return body as T;
}

export const productsApi = {
  list: () => jsonOrThrow<ProductSummary[]>('/api/products'),
  get: (id: string) => jsonOrThrow<ProductDetail>(`/api/products/${id}`),
  create: (body: {
    name: string;
    generalInfo?: string;
    icp: { targetIndustries: string[]; companySizes: string[]; geographies: string[]; notes?: string };
  }) =>
    jsonOrThrow<{ id: string; name: string; slug: string }>(`/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: {
      name?: string;
      generalInfo?: string;
      salesStrategy?: string;
      pricing?: string;
      agentModelTier?: AgentModelTier;
      agentExtraInstructions?: string;
      icpStrictness?: number;
    },
  ) =>
    jsonOrThrow<{ id: string; name: string }>(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  delete: async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error(`${res.status} ${res.statusText}`);
  },
  putIcp: (
    id: string,
    body: {
      targetIndustries: string[];
      companySizes: string[];
      fundingStages: string[];
      geographies: string[];
      notes?: string;
    },
  ) =>
    jsonOrThrow(`/api/products/${id}/icp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  addChild: (
    id: string,
    kind: 'sales-channels' | 'sources' | 'predefined-prospects',
    body: Record<string, unknown>,
  ) =>
    jsonOrThrow<{ id: string }>(`/api/products/${id}/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateChild: (
    id: string,
    kind: 'sales-channels' | 'sources' | 'predefined-prospects',
    childId: string,
    body: Record<string, unknown>,
  ) =>
    jsonOrThrow(`/api/products/${id}/${kind}/${childId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteChild: async (
    id: string,
    kind: 'sales-channels' | 'sources' | 'predefined-prospects',
    childId: string,
  ) => {
    const res = await fetch(`/api/products/${id}/${kind}/${childId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error(`${res.status} ${res.statusText}`);
  },
};

export const adminApi = {
  /**
   * Seed a rich demo scenario. Needs the APP_SECRET_KEY as the admin token.
   * Prompts the user for the token on first use; the prompt is deliberate —
   * this surface is operator-only and should not be a one-click footgun.
   */
  demoSeed: async (token: string) => {
    const res = await fetch('/admin/demo-seed', {
      method: 'POST',
      headers: { 'X-Admin-Token': token },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<{ productId: string; counts: Record<string, number> }>;
  },
};

export const productChatApi = {
  get: (productId: string) =>
    jsonOrThrow<ProductChatView>(`/products/${productId}/chat`),
  clear: async (productId: string) => {
    const res = await fetch(`/products/${productId}/chat`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error(`${res.status} ${res.statusText}`);
  },
  /** Start SSE stream. Returns an AbortController; consumer reads events via the callback. */
  stream: (
    productId: string,
    text: string,
    onEvent: (event: { type: string; [key: string]: unknown }) => void,
    onError?: (err: Error) => void,
    onDone?: () => void,
  ): AbortController => {
    const controller = new AbortController();
    fetch(`/products/${productId}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const parsed = parseSseEvent(rawEvent);
            if (parsed) onEvent(parsed);
          }
        }
        onDone?.();
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        onError?.(err as Error);
      });
    return controller;
  },
};

function parseSseEvent(raw: string): { type: string; [key: string]: unknown } | null {
  const lines = raw.split('\n');
  let eventType = 'message';
  let dataStr = '';
  for (const line of lines) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) eventType = line.slice(6).trim();
    else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
  }
  if (!dataStr) return null;
  try {
    const data = JSON.parse(dataStr);
    return { ...data, type: data.type ?? eventType };
  } catch {
    return null;
  }
}
