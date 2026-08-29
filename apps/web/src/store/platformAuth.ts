/**
 * Platform (owner) session state — separate from the tenant `useAuth`.
 *
 * Nothing is persisted: the access token lives in memory only, matching the
 * tenant store's "no credential in storage" rule. The session survives a reload
 * the same way the tenant one does — through an httpOnly refresh cookie the
 * server rotates on {@link bootstrap} — so a reload no longer signs the owner
 * out of the Home grid and switcher.
 */
import { create } from "zustand";
import { platformFetch, refreshPlatformSession } from "@/lib/platformApi";
import { env } from "@/lib/config";

/** Mirrors the `@greatsales/shared` PlatformUserView contract (local copy). */
export interface PlatformUserView {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PlatformLoginResponse {
  accessToken: string;
  expiresIn: number;
  platformUser: PlatformUserView;
}

/** "unknown" until bootstrap has run, so the guard can hold rather than bounce. */
export type PlatformSessionStatus = "unknown" | "ready";

interface PlatformAuthState {
  accessToken: string | null;
  platformUser: PlatformUserView | null;
  status: PlatformSessionStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Restore the session from the refresh cookie. Safe to call more than once. */
  bootstrap: () => Promise<void>;
  /** Drop the session without a server round-trip (e.g. after a failed refresh). */
  clear: () => void;
}

export const usePlatformAuth = create<PlatformAuthState>((set, get) => ({
  accessToken: null,
  platformUser: null,
  status: "unknown",

  login: async (email, password) => {
    const res = await platformFetch<PlatformLoginResponse>(
      "/platform/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    set({
      accessToken: res.accessToken,
      platformUser: res.platformUser,
      status: "ready",
    });
  },

  logout: async () => {
    try {
      await fetch(`${env.API_BASE_URL}/platform/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } catch {
      // A failed logout must still clear this device's session.
    } finally {
      set({ accessToken: null, platformUser: null, status: "ready" });
    }
  },

  bootstrap: async () => {
    if (get().accessToken) {
      set({ status: "ready" });
      return;
    }
    await refreshPlatformSession(); // updates the store on success/failure
    set({ status: "ready" });
  },

  clear: () => set({ accessToken: null, platformUser: null, status: "ready" }),
}));

/** True when an owner is signed in to the platform surface. */
export const useIsPlatformAuthed = (): boolean =>
  usePlatformAuth((s) => !!s.accessToken);

export const usePlatformUser = (): PlatformUserView | null =>
  usePlatformAuth((s) => s.platformUser);

export const usePlatformStatus = (): PlatformSessionStatus =>
  usePlatformAuth((s) => s.status);
