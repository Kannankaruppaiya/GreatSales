/**
 * Platform (owner) session state — separate from the tenant `useAuth`.
 *
 * Nothing is persisted: the platform token lives in memory only, matching the
 * tenant store's "no credential in storage" rule. There is no refresh flow, so
 * a page reload signs the owner out of the PLATFORM surface (the Home grid and
 * the switcher). It does NOT sign them out of a management they already opened —
 * that is an ordinary tenant session backed by the httpOnly refresh cookie, so
 * it survives the reload; the owner just re-authenticates here to switch again.
 * A platform refresh-cookie flow mirroring the tenant one is the follow-up.
 */
import { create } from "zustand";
import { platformFetch } from "@/lib/platformApi";

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

interface PlatformAuthState {
  accessToken: string | null;
  platformUser: PlatformUserView | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Drop the session without a server round-trip (e.g. after a 401). */
  clear: () => void;
}

export const usePlatformAuth = create<PlatformAuthState>((set) => ({
  accessToken: null,
  platformUser: null,

  login: async (email, password) => {
    const res = await platformFetch<PlatformLoginResponse>(
      "/platform/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    set({ accessToken: res.accessToken, platformUser: res.platformUser });
  },

  logout: () => set({ accessToken: null, platformUser: null }),
  clear: () => set({ accessToken: null, platformUser: null }),
}));

/** True when an owner is signed in to the platform surface. */
export const useIsPlatformAuthed = (): boolean =>
  usePlatformAuth((s) => !!s.accessToken);

export const usePlatformUser = (): PlatformUserView | null =>
  usePlatformAuth((s) => s.platformUser);
