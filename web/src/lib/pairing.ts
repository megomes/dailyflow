/** Pairing codes (EH): 8 characters without look-alikes, shown as text and QR. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newCode(rand: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...rand(8)].map(b => ALPHABET[b % ALPHABET.length]).join('');
}

/** Accepts user typing: spaces, dashes and lower case. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function codeHash(code: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`dailyflow-pair:${code}`));
  return Buffer.from(h).toString('hex');
}

export const pairUrl = (host: string, code: string) => `dailyflow://pair?host=${encodeURIComponent(host)}&code=${code}`;
