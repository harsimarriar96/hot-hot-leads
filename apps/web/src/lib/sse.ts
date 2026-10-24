import { apiFetch, errorFromResponse, parseBody } from './http';

export interface SseHandlers<TEvent> {
  onEvent: (event: TEvent) => void;
  onError?: (err: Error) => void;
  onDone?: () => void;
}

/**
 * POSTs `body` and reads the Server-Sent Events response. Returns an AbortController;
 * aborting silently stops delivery (the server keeps running the turn to completion).
 */
export function streamSse<TEvent extends { type: string }>(
  path: string,
  body: unknown,
  handlers: SseHandlers<TEvent>,
): AbortController {
  const controller = new AbortController();
  apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw errorFromResponse(res, await parseBody(res));
      if (!res.body) throw new Error('Empty response body');
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
          const parsed = parseSseEvent<TEvent>(rawEvent);
          if (parsed) handlers.onEvent(parsed);
        }
      }
      handlers.onDone?.();
    })
    .catch((err) => {
      if ((err as Error).name === 'AbortError') return;
      handlers.onError?.(err as Error);
    });
  return controller;
}

function parseSseEvent<TEvent extends { type: string }>(raw: string): TEvent | null {
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
    const data = JSON.parse(dataStr) as Record<string, unknown>;
    return { ...data, type: (data.type as string | undefined) ?? eventType } as TEvent;
  } catch {
    return null;
  }
}
