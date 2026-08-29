/**
 * Token storage. Auth tokens are secrets, so on device they live in the OS
 * keychain/keystore via expo-secure-store. On web (where SecureStore is
 * unavailable) we fall back to localStorage, and to an in-memory map if even
 * that is missing — every accessor is guarded so a storage failure degrades to
 * "signed out" rather than crashing the app.
 *
 * Requires the `expo-secure-store` package. Install the SDK-matched version:
 *   npx expo install expo-secure-store
 */
import { Platform } from 'react-native';

// Loaded lazily so a missing/unlinked native module can't break app startup.
type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let secureStore: SecureStoreModule | null | undefined;

function getSecureStore(): SecureStoreModule | null {
  if (secureStore !== undefined) return secureStore;
  if (Platform.OS === 'web') {
    secureStore = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStore = require('expo-secure-store') as SecureStoreModule;
  } catch {
    secureStore = null;
  }
  return secureStore;
}

const memoryStore = new Map<string, string>();

function webGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? memoryStore.get(key) ?? null;
  } catch {
    return memoryStore.get(key) ?? null;
  }
}
function webSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    memoryStore.set(key, value);
  }
}
function webDelete(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
  memoryStore.delete(key);
}

export const storage = {
  async get(key: string): Promise<string | null> {
    const store = getSecureStore();
    if (store) {
      try {
        return await store.getItemAsync(key);
      } catch {
        return null;
      }
    }
    return webGet(key);
  },
  async set(key: string, value: string): Promise<void> {
    const store = getSecureStore();
    if (store) {
      try {
        await store.setItemAsync(key, value);
        return;
      } catch {
        /* fall through to nothing — treated as signed out next launch */
        return;
      }
    }
    webSet(key, value);
  },
  async remove(key: string): Promise<void> {
    const store = getSecureStore();
    if (store) {
      try {
        await store.deleteItemAsync(key);
        return;
      } catch {
        return;
      }
    }
    webDelete(key);
  },
};
