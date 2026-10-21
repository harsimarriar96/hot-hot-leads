import { AuthService, safeEqual } from './auth.service';

describe('safeEqual', () => {
  it('compares strings of different lengths without throwing', () => {
    expect(safeEqual('a', 'abc')).toBe(false);
    expect(safeEqual('same', 'same')).toBe(true);
  });
});

describe('AuthService lockout', () => {
  it('locks a key after repeated failures and clears on success', () => {
    const svc = new AuthService();
    for (let i = 0; i < 5; i += 1) {
      expect(svc.isLockedOut('ip:1.2.3.4')).toBe(false);
      svc.recordFailure('ip:1.2.3.4');
    }
    expect(svc.isLockedOut('ip:1.2.3.4')).toBe(true);
    expect(svc.isLockedOut('ip:5.6.7.8')).toBe(false);
    svc.clearFailures('ip:1.2.3.4');
    expect(svc.isLockedOut('ip:1.2.3.4')).toBe(false);
  });

  it('keys ip and email independently', () => {
    const svc = new AuthService();
    for (let i = 0; i < 5; i += 1) svc.recordFailure('email:a@b.co');
    expect(svc.isLockedOut('email:a@b.co')).toBe(true);
    expect(svc.isLockedOut('ip:1.2.3.4')).toBe(false);
  });
});
