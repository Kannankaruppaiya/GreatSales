/**
 * Who is signed in, and the three things that change it: sign in, restore on
 * launch, sign out.
 *
 * This app is the salesperson's field tool. Sign-in sends `client: "mobile"`
 * and the API admits the `sales` role only on that client — it has no user
 * administration, role editor or tenant settings, so an administrator session
 * on a personal phone buys nothing and widens where an admin credential can be
 * left signed in. Sending the field is not what enforces that (anyone can post
 * to /auth/login claiming to be `web`); the server checks the role behind the
 * credential. Sending it honestly is what makes the refusal land.
 */
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearTokens,
  loadRefreshToken,
  persistRefreshToken,
  refreshSession,
  request,
  setAccessToken,
  setRememberDevice,
  setSessionExpiredHandler,
} from "./http";
import type { CurrentUser } from "./types";

export type SessionStatus = "unknown" | "signedOut" | "signedIn";

interface SessionState {
  status: SessionStatus;
  user: CurrentUser | null;
}

let state: SessionState = { status: "unknown", user: null };
const listeners = new Set<() => void>();

function setState(next: SessionState): void {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => state);
}

export function getSessionUser(): CurrentUser | null {
  return state.user;
}

/** Listeners that must drop cached rows when the person changes. */
const signOutHooks = new Set<() => void>();
export function onSignOut(hook: () => void): () => void {
  signOutHooks.add(hook);
  return () => signOutHooks.delete(hook);
}

function signedOut(): void {
  signOutHooks.forEach((h) => h());
  setState({ status: "signedOut", user: null });
}

// A refresh the server rejected mid-session ends the session everywhere.
setSessionExpiredHandler(() => {
  void clearTokens().finally(signedOut);
});

const LAST_WORKSPACE_KEY = "gs_last_workspace";

/** The workspace code last signed in to — a convenience, not a secret. */
export async function lastWorkspace(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: CurrentUser;
}

export async function signIn(input: {
  workspace: string;
  email: string;
  password: string;
  remember: boolean;
}): Promise<CurrentUser> {
  // The workspace is typed as its short code; the API keys tenants as
  // `tenant_<code>`. Accept either so a pasted full id also works.
  const code = input.workspace.trim().toLowerCase();
  const tenantId = code.startsWith("tenant_") ? code : `tenant_${code}`;

  setRememberDevice(input.remember);
  const res = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      tenantId,
      email: input.email.trim().toLowerCase(),
      password: input.password,
      tokenDelivery: "body",
      client: "mobile",
    }),
  });
  setAccessToken(res.accessToken);
  await persistRefreshToken(res.refreshToken);
  try {
    await AsyncStorage.setItem(
      LAST_WORKSPACE_KEY,
      code.replace(/^tenant_/, ""),
    );
  } catch {
    /* a convenience; never fail a sign-in over it */
  }
  setState({ status: "signedIn", user: res.user });
  return res.user;
}

/**
 * Restore a session on launch from the stored refresh token.
 *
 * A network failure is NOT treated as signed out: a salesperson who opens the
 * app in a basement car park must not lose their session for it. The error is
 * rethrown so the caller can offer a retry.
 */
export async function restoreSession(): Promise<SessionStatus> {
  if (state.status === "signedIn") return state.status;
  const stored = await loadRefreshToken();
  if (!stored) {
    setState({ status: "signedOut", user: null });
    return "signedOut";
  }
  const token = await refreshSession();
  if (!token) {
    setState({ status: "signedOut", user: null });
    return "signedOut";
  }
  const user = await request<CurrentUser>("/auth/me");
  setState({ status: "signedIn", user });
  return "signedIn";
}

/** Re-read the profile — after a password change clears `mustChangePassword`. */
export async function reloadUser(): Promise<CurrentUser> {
  const user = await request<CurrentUser>("/auth/me");
  setState({ status: "signedIn", user });
  return user;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await request("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await reloadUser();
}

/** Revoke this device's session on the server, then forget it locally. */
export async function signOut(): Promise<void> {
  try {
    // The refresh token names the session to revoke; without it the server
    // has nothing to end, and the token would stay valid until it expires.
    const refreshToken = await loadRefreshToken();
    await request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({
        allSessions: false,
        ...(refreshToken ? { refreshToken } : {}),
      }),
    });
  } catch {
    // Local sign-out must happen even when the server cannot be reached.
  } finally {
    await clearTokens();
    signedOut();
  }
}
