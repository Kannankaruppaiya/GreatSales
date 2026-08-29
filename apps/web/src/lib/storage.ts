/**
 * Token storage. Uses localStorage, guarded so a disabled/full store degrades
 * to "signed out" rather than throwing.
 *
 * SECURITY NOTE: localStorage is readable by any script on the page, so tokens
 * here are exposed to XSS. The production hardening is to have the API set the
 * refresh token as an httpOnly, Secure, SameSite cookie and keep only a
 * short-lived access token in memory. The current API returns tokens in the
 * response body with no cookie flow, so this mirrors that; swap this module for
 * the cookie flow when the API supports it.
 */
const memory = new Map<string, string>();

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    memory.delete(key);
  },
};
