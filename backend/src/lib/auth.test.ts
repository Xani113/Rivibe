import { describe, it, expect } from 'vitest';
import { hashPassword, signSessionToken, verifyPassword, verifySessionToken } from './auth';

describe('auth security helpers', () => {
  it('hashes and verifies passwords with bcryptjs', async () => {
    const hash = await hashPassword('RiVibeSecret123!');
    expect(hash).not.toBe('RiVibeSecret123!');
    expect(await verifyPassword('RiVibeSecret123!', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('signs and verifies JWT session tokens and rejects tampered tokens', async () => {
    const token = await signSessionToken({
      userId: 'usr-1',
      email: 'manoj@rivibe.app',
      displayName: 'Manoj',
    });

    const payload = await verifySessionToken(token);
    expect(payload?.userId).toBe('usr-1');
    expect(payload?.email).toBe('manoj@rivibe.app');

    const invalid = await verifySessionToken(`${token}tampered`);
    expect(invalid).toBeNull();
  });
});
