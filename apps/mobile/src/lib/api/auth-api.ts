/**
 * Auth endpoints, typed against the wire contracts. These are thin — all the
 * cross-cutting concerns (timeouts, errors, refresh) live in the client.
 */
import { apiFetch } from './client';
import type { AuthTokens, AuthUser, LoginInput, LoginResponse } from './types';

export function login(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: input });
}

export function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/refresh', { method: 'POST', body: { refreshToken } });
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', { method: 'GET', auth: true });
}
