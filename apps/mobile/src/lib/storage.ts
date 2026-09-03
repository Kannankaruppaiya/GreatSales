import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Cross-platform key/value store for auth tokens. Native uses the OS keychain
 * (expo-secure-store); web falls back to localStorage (SecureStore is
 * unavailable there). All calls are best-effort and never throw — a storage
 * failure degrades to "logged out", it does not crash the app.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return globalThis.localStorage?.getItem(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore — persistence is best-effort
    }
  },

  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage?.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};

export const StorageKeys = {
  accessToken: 'gs.accessToken',
  refreshToken: 'gs.refreshToken',
  tenantId: 'gs.tenantId',
} as const;
