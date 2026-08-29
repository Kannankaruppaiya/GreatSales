/**
 * Wire contracts, mirrored from `@greatsales/shared` (the API's source of
 * truth). Kept as a local copy so the mobile bundle stays self-contained; if
 * these drift from the server the typed responses will surface it.
 */
export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  username: string;
  roleId: string;
  role: string | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginResponse = AuthTokens & { user: AuthUser };

export type LoginInput = {
  tenantId: string;
  email: string;
  password: string;
};

/** Canonical API error envelope emitted by the server for every non-2xx. */
export type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
};
