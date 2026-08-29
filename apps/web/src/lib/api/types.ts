/**
 * Wire contracts, mirrored from `@greatsales/shared` (the API's source of
 * truth) and kept identical to the mobile app's copy so both clients stay in
 * lockstep with the server.
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

export type ApiErrorBody = {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
};
