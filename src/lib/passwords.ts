// Client-side credential helpers (browser only).

const LOWER = "abcdefghijkmnpqrstuvwxyz"; // no l
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const DIGIT = "23456789"; // no 0, 1
const SYMBOL = "!@#$%^&*-_=+";
const ALL = LOWER + UPPER + DIGIT + SYMBOL;

function pick(set: string, n: number): string[] {
  const out: string[] = [];
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) out.push(set[buf[i] % set.length]);
  return out;
}

/** Cryptographically strong password with at least one char from each class. */
export function generatePassword(length = 16): string {
  const chars = [
    ...pick(LOWER, 1),
    ...pick(UPPER, 1),
    ...pick(DIGIT, 1),
    ...pick(SYMBOL, 1),
    ...pick(ALL, Math.max(0, length - 4)),
  ];
  // Fisher–Yates shuffle so the guaranteed chars aren't always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/**
 * Explicitly store the credential in the browser's password manager via the
 * Credential Management API. Works in Chrome on localhost/HTTPS; silently
 * no-ops elsewhere (the autocomplete attributes remain the fallback).
 */
export async function saveToPasswordManager(email: string, password: string): Promise<void> {
  try {
    const w = window as unknown as {
      PasswordCredential?: new (data: { id: string; password: string; name?: string }) => Credential;
    };
    if (w.PasswordCredential && navigator.credentials?.store) {
      const cred = new w.PasswordCredential({ id: email, password, name: email });
      await navigator.credentials.store(cred);
    }
  } catch {
    // Browser declined or unsupported — autocomplete attributes still apply.
  }
}
