import { ConfigService } from '@nestjs/config';

import { AuthService, safeEqual } from './auth.service';

function makeService(password: string | undefined, secret = 'a'.repeat(32)): AuthService {
  const values: Record<string, string | undefined> = {
    'security.appSecretKey': secret,
    'security.authPassword': password,
  };
  const svc = new AuthService({ get: (key: string) => values[key] } as unknown as ConfigService);
  svc.onModuleInit();
  return svc;
}

describe('safeEqual', () => {
  it('compares strings of different lengths without throwing', () => {
    expect(safeEqual('a', 'abc')).toBe(false);
    expect(safeEqual('same', 'same')).toBe(true);
  });
});

describe('AuthService', () => {
  it('refuses to boot without APP_AUTH_PASSWORD', () => {
    expect(() => makeService(undefined)).toThrow(/APP_AUTH_PASSWORD/);
  });

  it('verifies the password and issues a stable token', () => {
    const a = makeService('hunter2');
    const b = makeService('hunter2');
    expect(a.verifyPassword('hunter2')).toBe(true);
    expect(a.verifyPassword('hunter3')).toBe(false);
    // Stateless: a second instance (restart) derives the same token.
    expect(a.issueToken()).toBe(b.issueToken());
    expect(a.verifyToken(b.issueToken())).toBe(true);
    expect(a.verifyToken('not-a-token')).toBe(false);
  });

  it('rotating either secret invalidates the token', () => {
    const base = makeService('hunter2');
    expect(makeService('other').verifyToken(base.issueToken())).toBe(false);
    expect(makeService('hunter2', 'b'.repeat(32)).verifyToken(base.issueToken())).toBe(false);
  });

  it('locks out an address after repeated failures', () => {
    const svc = makeService('hunter2');
    for (let i = 0; i < 5; i += 1) {
      expect(svc.isLockedOut('1.2.3.4')).toBe(false);
      svc.recordFailure('1.2.3.4');
    }
    expect(svc.isLockedOut('1.2.3.4')).toBe(true);
    expect(svc.isLockedOut('5.6.7.8')).toBe(false);
    svc.clearFailures('1.2.3.4');
    expect(svc.isLockedOut('1.2.3.4')).toBe(false);
  });
});
