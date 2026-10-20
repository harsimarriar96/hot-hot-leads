import { ConfigService } from '@nestjs/config';

import { CryptoService } from './crypto.service';

function makeService(secret: string | undefined): CryptoService {
  const config = { get: () => secret } as unknown as ConfigService;
  const svc = new CryptoService(config);
  svc.onModuleInit();
  return svc;
}

describe('CryptoService', () => {
  it('requires a 32+ char APP_SECRET_KEY', () => {
    expect(() => makeService(undefined)).toThrow(/APP_SECRET_KEY/);
    expect(() => makeService('short')).toThrow(/APP_SECRET_KEY/);
  });

  it('round-trips plaintext and never stores it verbatim', () => {
    const svc = makeService('x'.repeat(32));
    const payload = svc.encrypt('123456:bot-token');
    expect(payload.ciphertext.toString('utf8')).not.toContain('bot-token');
    expect(svc.decrypt(payload)).toBe('123456:bot-token');
  });

  it('fails to decrypt with a different key', () => {
    const payload = makeService('x'.repeat(32)).encrypt('secret');
    expect(() => makeService('y'.repeat(32)).decrypt(payload)).toThrow();
  });
});
