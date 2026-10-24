import type { Response } from 'express';

const KEEPALIVE_MS = 15_000;

/**
 * Streams an async generator of events to the response as Server-Sent Events.
 * Each event is written as `event: <type>` + `data: <json>`. If the client
 * disconnects the generator is still drained to completion so the caller's side
 * effects (persisting the assistant message) always finish.
 */
export async function streamSse<T extends { type: string }>(
  res: Response,
  events: AsyncGenerator<T>,
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const heartbeat = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, KEEPALIVE_MS);

  let clientDisconnected = false;
  res.on('close', () => {
    clientDisconnected = true;
  });

  try {
    for await (const event of events) {
      if (!clientDisconnected) send(event.type, event);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!clientDisconnected) send('error', { type: 'error', code: 'run_failed', message });
  } finally {
    clearInterval(heartbeat);
    if (!clientDisconnected) res.end();
  }
}
