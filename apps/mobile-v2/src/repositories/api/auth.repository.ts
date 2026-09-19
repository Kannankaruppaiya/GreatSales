import type { AuthUser, LoginResponse } from '@greatsales/shared';
import {
  apiFetch,
  setAccessToken,
  persistRefreshToken,
  loadRefreshToken,
  clearTokens,
} from '../../lib/api';
import type { AuthRepository } from '../interfaces';

/**
 * Sign-in against the real API.
 *
 * `client: 'mobile'` is sent honestly. The server admits only a `sales` role
 * from mobile and refuses anything else with a 403 AFTER the password
 * verifies - a specific refusal before that would be an account-enumeration
 * oracle (AGENTS.md). Claiming to be `web` would not widen anything, since the
 * server checks the role behind the credential, but sending it truthfully is
 * what makes the refusal land on the right accounts.
 *
 * `tokenDelivery: 'body'` because a native app cannot hold the httpOnly cookie
 * the web client uses; the refresh token goes to the OS keychain instead.
 */
export const apiAuthRepository: AuthRepository = {
  async login(tenantId, email, password) {
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        email,
        password,
        tokenDelivery: 'body',
        client: 'mobile',
      }),
    });

    setAccessToken(res.accessToken);
    // Present because tokenDelivery is 'body'; the schema marks it optional
    // for the cookie case only.
    if (res.refreshToken) await persistRefreshToken(res.refreshToken);

    return { user: res.user, token: res.accessToken };
  },

  /**
   * Sends the refresh token, which is what actually ends the session.
   *
   * The server revokes the token family identified by the token it is given;
   * a web client supplies it through the httpOnly cookie. Mobile holds it in
   * the keychain instead, so a body without it reaches
   * `if (!token) return { revoked: 0 }` - the call succeeds, the phone clears,
   * and the refresh token stays valid for the rest of its seven days. That is
   * what apps/mobile does today, and it means a captured token outlives the
   * sign-out that was supposed to kill it.
   */
  async logout(allSessions = false) {
    try {
      const refreshToken = await loadRefreshToken();
      await apiFetch<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          ...(refreshToken ? { refreshToken } : {}),
          allSessions,
        }),
      });
    } finally {
      // The local session goes even if the server never heard about it -
      // otherwise a sign-out over a dead connection leaves the phone signed in.
      await clearTokens();
    }
  },

  async getCurrentUser() {
    return apiFetch<AuthUser>('/auth/me');
  },

  async changePassword(oldPw, newPw) {
    await apiFetch<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: oldPw, newPassword: newPw }),
    });
  },
};
