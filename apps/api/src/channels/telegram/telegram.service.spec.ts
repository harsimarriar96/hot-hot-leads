import { ConfigService } from '@nestjs/config';

import { TelegramService } from './telegram.service';

function makeService(secret: string | undefined): TelegramService {
  const config = {
    get: (key: string) => (key === 'telegram.webhookSecret' ? secret : 'bot-token'),
  } as unknown as ConfigService;
  return new TelegramService(config);
}

describe('TelegramService.verifySecretToken', () => {
  it('rejects every request when no secret is configured', () => {
    const svc = makeService('');
    expect(svc.verifySecretToken('anything')).toBe(false);
    expect(svc.verifySecretToken(undefined)).toBe(false);
  });

  it('rejects a missing or mismatched header', () => {
    const svc = makeService('s3cret');
    expect(svc.verifySecretToken(undefined)).toBe(false);
    expect(svc.verifySecretToken('')).toBe(false);
    expect(svc.verifySecretToken('wrong')).toBe(false);
    expect(svc.verifySecretToken('s3cret-but-longer')).toBe(false);
  });

  it('accepts the exact secret Telegram echoes back', () => {
    const svc = makeService('s3cret');
    expect(svc.verifySecretToken('s3cret')).toBe(true);
  });
});
