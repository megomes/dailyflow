import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Access-code hashing. The plaintext code is never stored; ACCESS_CODE_HASH holds
 * `scrypt:<saltHex>:<hashHex>`. Generate one with `npm run hash-code -- "<code>"`.
 */
const N = 16384, KEYLEN = 32;

export function hashCode(code: string, salt = randomBytes(16)): string {
  const hash = scryptSync(normalize(code), salt, KEYLEN, { N });
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyCode(code: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [algo, saltHex, hashHex] = stored.split(':');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(normalize(code), Buffer.from(saltHex, 'hex'), expected.length, { N });
  return timingSafeEqual(actual, expected);
}

/** Codes are case- and whitespace-insensitive to be easy to type on a phone. */
function normalize(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, '');
}
