#!/usr/bin/env node
// Prints ACCESS_CODE_HASH for an access code. Usage: npm run hash-code -- "my code"
// Keep in sync with src/lib/password.ts (scrypt, N=16384, 32-byte key, normalized code).
import { randomBytes, scryptSync } from 'node:crypto';

const code = process.argv.slice(2).join(' ');
if (!code) {
  console.error('Usage: npm run hash-code -- "<access code>"');
  process.exit(1);
}
const normalized = code.trim().toLowerCase().replace(/\s+/g, '');
const salt = randomBytes(16);
const hash = scryptSync(normalized, salt, 32, { N: 16384 });
console.log(`scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
