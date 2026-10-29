import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHmac } from 'node:crypto';

import { WhatsAppService } from './whatsapp.service';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { __esModule: true, ...actual, default: { post: jest.fn() } };
});

const post = axios.post as jest.Mock;

function makeService(appSecret: string, verifyToken = 'verify-me'): WhatsAppService {
  const values: Record<string, string> = {
    'whatsapp.phoneNumberId': '123',
    'whatsapp.accessToken': 'token',
    'whatsapp.verifyToken': verifyToken,
    'whatsapp.appSecret': appSecret,
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  return new WhatsAppService(config);
}

describe('WhatsAppService.verifySignature', () => {
  const body = Buffer.from(JSON.stringify({ entry: [] }));
  const sign = (secret: string, payload: Buffer) =>
    `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

  it('rejects everything when no app secret is configured', () => {
    expect(makeService('').verifySignature(body, sign('x', body))).toBe(false);
  });

  it('rejects a missing header, missing body, or wrong signature', () => {
    const svc = makeService('app-secret');
    expect(svc.verifySignature(body, undefined)).toBe(false);
    expect(svc.verifySignature(undefined, sign('app-secret', body))).toBe(false);
    expect(svc.verifySignature(body, sign('other-secret', body))).toBe(false);
    expect(svc.verifySignature(Buffer.from('tampered'), sign('app-secret', body))).toBe(false);
  });

  it('accepts a valid Meta signature over the raw body', () => {
    const svc = makeService('app-secret');
    expect(svc.verifySignature(body, sign('app-secret', body))).toBe(true);
  });
});

describe('WhatsAppService.verifyWebhook', () => {
  it('echoes the challenge only for a matching verify token', () => {
    const svc = makeService('secret', 'verify-me');
    expect(svc.verifyWebhook('subscribe', 'verify-me', 'challenge-1')).toBe('challenge-1');
    expect(svc.verifyWebhook('subscribe', 'nope', 'challenge-1')).toBeNull();
    expect(svc.verifyWebhook('unsubscribe', 'verify-me', 'challenge-1')).toBeNull();
  });

  it('never matches an empty configured token', () => {
    const svc = makeService('secret', '');
    expect(svc.verifyWebhook('subscribe', '', 'challenge-1')).toBeNull();
  });
});

describe('WhatsAppService.send', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: {} });
  });

  it('converts markdown to WhatsApp formatting', async () => {
    await makeService('secret').send({
      chatId: '15551234',
      text: '## Hi\n\n**bold** [x](https://x.io)',
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('https://graph.facebook.com/v19.0/123/messages');
    expect(post.mock.calls[0][1]).toEqual({
      messaging_product: 'whatsapp',
      to: '15551234',
      type: 'text',
      text: { body: '*Hi*\n\n*bold* x (https://x.io)' },
    });
    expect(post.mock.calls[0][2]).toEqual({ headers: { Authorization: 'Bearer token' } });
  });

  it('sends plain text as is', async () => {
    await makeService('secret').send({ chatId: '1', text: '**raw**', format: 'plain' });
    expect(post.mock.calls[0][1].text).toEqual({ body: '**raw**' });
  });

  it('sends long messages as sequential chunks within the 4096 limit', async () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `${i}${'p'.repeat(1000)}`);
    await makeService('secret').send({ chatId: '1', text: paragraphs.join('\n\n') });

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1].text.body.length).toBeLessThanOrEqual(4096);
    // The markdown is cut at 4000 characters, so three 1001-character paragraphs fit per part.
    expect(post.mock.calls[1][1].text.body.startsWith('3')).toBe(true);
  });

  it('wraps failures without exposing the axios error', async () => {
    post.mockRejectedValueOnce(new Error('boom'));
    await expect(makeService('secret').send({ chatId: '1', text: 'hi' })).rejects.toThrow(
      'WhatsApp send failed: boom',
    );
  });
});
