import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing. @node-rs/argon2 ships prebuilt native binaries (no
 * node-gyp), so this works cross-platform including Windows dev. Argon2id with
 * library defaults — a good production baseline; tune cost params before scale.
 */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  return verify(storedHash, plain);
}
