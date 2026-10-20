import { AxiosError } from 'axios';

/**
 * Summarise an outbound HTTP failure without leaking the request URL or
 * headers (Telegram puts the bot token in the URL; Meta uses a bearer header).
 */
export function describeHttpError(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const body = err.response?.data;
    const detail =
      body && typeof body === 'object' && 'description' in body
        ? String((body as { description: unknown }).description)
        : err.message;
    return status ? `${status} ${detail}` : detail;
  }
  return err instanceof Error ? err.message : String(err);
}
