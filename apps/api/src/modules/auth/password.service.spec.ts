import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('round-trips a password and rejects a wrong one', async () => {
    const stored = await svc.hash('correct horse battery');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await svc.verify('correct horse battery', stored)).toBe(true);
    expect(await svc.verify('correct horse batter', stored)).toBe(false);
  });

  it('salts every hash', async () => {
    const a = await svc.hash('same-password');
    const b = await svc.hash('same-password');
    expect(a).not.toBe(b);
  });

  it('rejects malformed or missing stored values without throwing', async () => {
    expect(await svc.verify('x', null)).toBe(false);
    expect(await svc.verify('x', undefined)).toBe(false);
    expect(await svc.verify('x', 'bcrypt$10$abc')).toBe(false);
    expect(await svc.verify('x', 'scrypt$notanumber$8$1$c2FsdA==$aGFzaA==')).toBe(false);
  });
});
