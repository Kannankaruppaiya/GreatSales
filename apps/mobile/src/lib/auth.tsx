import type { AuthUser } from '@greatsales/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { storage, StorageKeys } from './storage';

interface AuthState {
  /** true until the initial session restore completes. */
  loading: boolean;
  user: AuthUser | null;
  /** Last tenant id used, remembered to prefill the login form. */
  lastTenantId: string | null;
  signIn: (tenantId: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [lastTenantId, setLastTenantId] = useState<string | null>(null);

  // Restore any persisted session on boot: load tokens, remember the last
  // tenant, and validate the token by fetching the current user.
  useEffect(() => {
    let active = true;
    (async () => {
      await api.hydrate();
      const tenant = await storage.get(StorageKeys.tenantId);
      if (active) setLastTenantId(tenant);
      if (api.hasSession()) {
        try {
          const me = await api.me();
          if (active) setUser(me);
        } catch {
          await api.clearTokens();
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(
    async (tenantId: string, email: string, password: string) => {
      const res = await api.login(tenantId, email, password);
      await storage.set(StorageKeys.tenantId, tenantId);
      setLastTenantId(tenantId);
      setUser(res.user);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ loading, user, lastTenantId, signIn, signOut }),
    [loading, user, lastTenantId, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
