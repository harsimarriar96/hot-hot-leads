import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

import { WhatsAppService } from './whatsapp.service';

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
