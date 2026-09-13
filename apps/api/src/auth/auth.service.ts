import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type {
  AuthClient,
  AuthTokens,
  AuthUser,
  ChangePasswordInput,
  JwtRefreshClaims,
  LoginInput,
  LoginResponse,
  RequestUser,
} from '@greatsales/shared';
import {
  PASSWORD_FAILURE_MESSAGE,
  roleAllowedOnClient,
  roleMatchesPortal,
  validatePassword,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './hash';
import { codedBadRequest } from '../common/error-codes';

/**
 * Request context used for auth telemetry and for stamping issued tokens.
 * Never contains a credential.
 */
export interface AuthContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

/** Outcome of a token issue, including what the transport layer must set. */
export interface IssuedSession extends AuthTokens {
  /** Always present. The controller decides whether it reaches the body. */
  refreshTokenValue: string;
  refreshExpiresAt: Date;
}

/**
 * A real argon2id hash of a random value nobody knows. Verified against when
 * the account does not exist so that the not-found path costs the same as a
 * wrong-password path. Without this, response time reveals which emails are
 * registered (AGENTS.md §7).
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$nYC9H0SbYS8cnQQWhuBfDQ$dEiS+FncrZu00AgZm3HXh6n1XW/fxFkKuDFOSzgKUDU';

/**
 * Include graph that resolves a user's role AND its permission keys in one
 * query. Used by login and /auth/me so the client learns its capabilities
 * without a second round trip and without an N+1 per permission.
 */
const ROLE_WITH_PERMISSIONS = {
  role: { include: { permissions: { include: { permission: true } } } },
} as const;

/**
 * The minimal write surface {@link AuthService.revokeAllForUser} needs.
 *
 * Structural rather than `TenantPrisma`, so the same method accepts both a
 * tenant-scoped client and the `Prisma.TransactionClient` handed to an
 * interactive transaction — which is the whole point: an administrative write
 * must be able to revoke sessions inside its own transaction.
 */
export interface RefreshTokenWritable {
  refreshToken: {
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
}

/** Consecutive failures before an account is temporarily locked. */
export const MAX_FAILED_ATTEMPTS = 5;
/** How long a locked account stays locked. */
export const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  /**
   * Auth telemetry. Every event carries outcome, tenant, and source so an
   * attack is visible in logs; no password, hash, or token is ever logged
   * (AGENTS.md §13).
   */
  private readonly log = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Authenticate within a tenant.
   *
   * Every DB read/write runs under the tenant's RLS scope (forTenant), so a
   * wrong tenantId simply sees no rows. All failure modes return the same
   * "Invalid credentials" and take comparable time, so neither the message nor
   * the latency reveals whether a tenant or an email exists.
   *
   * The one deliberate exception is lockout: a caller who has already failed
   * repeatedly is told the account is locked. That confirms little to someone
   * who has already been guessing, and silence here would make the product
   * unsupportable.
   */
  async login(
    input: LoginInput,
    ctx: AuthContext = {},
  ): Promise<
    LoginResponse & { refreshTokenValue: string; refreshExpiresAt: Date }
  > {
    const db = this.prisma.forTenant(input.tenantId);

    const tenant = await db.tenant.findUnique({
      where: { id: input.tenantId },
    });
    const tenantUsable =
      !!tenant &&
      !tenant.deletedAt &&
      tenant.status !== 'Suspended' &&
      tenant.status !== 'Churned';

    // Looked up even when the tenant is unusable so the query cost — and the
    // argon2 verify below — is paid on every path.
    const user = tenantUsable
      ? await db.user.findFirst({
          where: { email: input.email, deletedAt: null, active: true },
          include: ROLE_WITH_PERMISSIONS,
        })
      : null;

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      this.event('login.locked', ctx, {
        tenantId: input.tenantId,
        userId: user.id,
      });
      throw new ForbiddenException(
        'Account temporarily locked after repeated failed sign-in attempts. Try again later.',
      );
    }

    const ok = await verifyPassword(
      user?.passwordHash ?? DUMMY_HASH,
      input.password,
    );

    if (!tenantUsable || !user || !ok) {
      if (user) await this.recordFailure(db, user.id, user.failedLoginAttempts);
      this.event('login.failed', ctx, {
        tenantId: input.tenantId,
        // Whether the account exists is security-relevant and stays in the log,
        // never in the response.
        accountExists: !!user,
        tenantUsable,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Credentials are proven. Only now is it safe to say anything specific:
    // the two checks below tell the caller WHY a valid account was refused,
    // which would be an enumeration oracle if it happened before the password
    // was verified, and is merely helpful after it.
    const roleName = user.role?.name ?? null;
    const permissionKeys =
      user.role?.permissions?.map((rp) => rp.permission.key) ?? [];

    if (!roleAllowedOnClient(input.client, roleName, permissionKeys)) {
      this.event('login.client_not_permitted', ctx, {
        tenantId: input.tenantId,
        userId: user.id,
        client: input.client,
        role: roleName,
      });
      throw new ForbiddenException(
        input.client === 'mobile'
          ? 'This account cannot sign in from the mobile app. The app is for field sales; use the web console instead.'
          : 'This account cannot sign in from this application.',
      );
    }

    // Per-role web doors are only real if the server checks which one was used.
    // Otherwise /sales/login and /admin/login post identical bodies and the URL
    // is decoration.
    if (input.portal && !roleMatchesPortal(input.portal, roleName)) {
      this.event('login.wrong_portal', ctx, {
        tenantId: input.tenantId,
        userId: user.id,
        portal: input.portal,
        role: roleName,
      });
      throw new ForbiddenException(
        'This sign-in page is not for your account. Use the address your administrator gave you.',
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastIp: ctx.ip ?? null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const session = await this.startSession(
      user.tenantId,
      user.id,
      user.roleId,
      input.client,
      ctx,
    );
    this.event('login.success', ctx, {
      tenantId: user.tenantId,
      userId: user.id,
    });

    return { ...session, user: this.toAuthUser(user) };
  }

  /**
   * Exchange a refresh token for a fresh pair, rotating it.
   *
   * The presented token must verify AND have a live row whose id matches its
   * `jti`. Presenting a token that was already rotated means someone replayed a
   * stolen copy, so the entire family is revoked — the legitimate holder is
   * signed out too, which is the correct outcome when a credential is known to
   * have leaked.
   */
  async refresh(token: string, ctx: AuthContext = {}): Promise<IssuedSession> {
    let claims: JwtRefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<JwtRefreshClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      this.event('refresh.invalid_signature', ctx, {});
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (claims.typ !== 'refresh' || !claims.jti || !claims.fid) {
      this.event('refresh.wrong_token_type', ctx, { tenantId: claims.tid });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const db = this.prisma.forTenant(claims.tid);

    // A tenant suspended after this token was issued must not keep refreshing.
    const tenant = await db.tenant.findUnique({ where: { id: claims.tid } });
    if (
      !tenant ||
      tenant.deletedAt ||
      tenant.status === 'Suspended' ||
      tenant.status === 'Churned'
    ) {
      await this.revokeFamily(db, claims.fid, 'tenant_not_active');
      this.event('refresh.tenant_not_active', ctx, { tenantId: claims.tid });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const row = await db.refreshToken.findUnique({ where: { id: claims.jti } });
    if (!row) {
      // Verifies but has no row: issued before a revocation sweep, or forged
      // with a leaked signing key. Either way, distrust the whole family.
      await this.revokeFamily(db, claims.fid, 'unknown_token');
      this.event('refresh.unknown_token', ctx, {
        tenantId: claims.tid,
        familyId: claims.fid,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (row.usedAt) {
      await this.revokeFamily(db, row.familyId, 'reuse_detected');
      this.event('refresh.reuse_detected', ctx, {
        tenantId: claims.tid,
        userId: row.userId,
        familyId: row.familyId,
        severity: 'high',
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (row.revokedAt || row.expiresAt <= new Date()) {
      this.event('refresh.expired_or_revoked', ctx, {
        tenantId: claims.tid,
        userId: row.userId,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    // The role travels with the user here because rotation re-checks it: a
    // session's client permission depends on the role the account holds NOW,
    // not the one it held when it signed in.
    const user = await db.user.findFirst({
      where: { id: row.userId, deletedAt: null, active: true },
      include: ROLE_WITH_PERMISSIONS,
    });
    if (!user) {
      await this.revokeFamily(db, row.familyId, 'user_not_active');
      this.event('refresh.user_not_active', ctx, {
        tenantId: claims.tid,
        userId: row.userId,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.revokeFamily(db, row.familyId, 'user_locked');
      this.event('refresh.user_locked', ctx, {
        tenantId: claims.tid,
        userId: user.id,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    // The client restriction has to hold for the life of the session, not just
    // its first request. A role can also be reassigned after sign-in — an
    // account promoted to admin while its phone still holds a live session must
    // lose that session, not keep it until the refresh token expires.
    const sessionClient: AuthClient = claims.cli ?? 'web';
    const roleName = user.role?.name ?? null;
    const permissionKeys =
      user.role?.permissions?.map((rp) => rp.permission.key) ?? [];
    if (!roleAllowedOnClient(sessionClient, roleName, permissionKeys)) {
      await this.revokeFamily(db, row.familyId, 'client_not_permitted');
      this.event('refresh.client_not_permitted', ctx, {
        tenantId: claims.tid,
        userId: user.id,
        client: sessionClient,
        role: roleName,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const next = await this.issueInFamily(
      db,
      user.tenantId,
      user.id,
      user.roleId,
      row.familyId,
      sessionClient,
      ctx,
    );

    // Consume the presented token only after its replacement exists, so a crash
    // between the two leaves the caller with a token that still works.
    await db.refreshToken.update({
      where: { id: row.id },
      data: { usedAt: new Date(), replacedById: next.jti },
    });

    this.event('refresh.rotated', ctx, {
      tenantId: user.tenantId,
      userId: user.id,
      familyId: row.familyId,
    });
    return next.session;
  }

  /**
   * Revoke EVERY live refresh family belonging to one user.
   *
   * Takes the tenant-bound client as a PARAMETER rather than creating its own,
   * so an administrative write — deactivate, delete, password reset, role
   * change — can revoke inside its own transaction. The mutation, its audit
   * row, and the revocation then commit or roll back together; otherwise a
   * crash between them could leave sessions alive on an account the operator
   * believes they have already disabled.
   *
   * `reason` is stored on each row so an operator can tell from the data WHY a
   * session ended: admin_deactivated, admin_deleted, admin_password_reset,
   * role_changed, self_password_change, logout_all.
   *
   * Returns the number of families actually revoked, so a second call on an
   * already-revoked user returns 0 rather than pretending to have done work.
   */
  async revokeAllForUser(
    db: RefreshTokenWritable,
    userId: string,
    reason: string,
  ): Promise<number> {
    const res = await db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return res.count;
  }

  /**
   * End a session for real: revoke the presented token's family server-side so
   * the refresh token stops working immediately, rather than only clearing
   * client state.
   *
   * Logout never throws on a bad token — a client trying to sign out must always
   * end up signed out — but it revokes whatever it legitimately can.
   */
  async logout(
    token: string | undefined,
    allSessions: boolean,
    principal: RequestUser | null,
    ctx: AuthContext = {},
  ): Promise<{ revoked: number }> {
    if (allSessions && principal) {
      const db = this.prisma.forTenant(principal.tenantId);
      const revoked = await this.revokeAllForUser(
        db,
        principal.userId,
        'logout_all',
      );
      this.event('logout.all_sessions', ctx, {
        tenantId: principal.tenantId,
        userId: principal.userId,
        revoked,
      });
      return { revoked };
    }

    if (!token) return { revoked: 0 };

    let claims: JwtRefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<JwtRefreshClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      // An unverifiable token cannot identify a family to revoke. Nothing to do.
      return { revoked: 0 };
    }
    if (claims.typ !== 'refresh' || !claims.fid) return { revoked: 0 };

    const db = this.prisma.forTenant(claims.tid);
    const revoked = await this.revokeFamily(db, claims.fid, 'logout');
    this.event('logout.session', ctx, {
      tenantId: claims.tid,
      userId: claims.sub,
      familyId: claims.fid,
      revoked,
    });
    return { revoked };
  }

  /** Current authenticated user profile. */
  async me(principal: RequestUser): Promise<AuthUser> {
    const db = this.prisma.forTenant(principal.tenantId);
    const user = await db.user.findFirst({
      where: { id: principal.userId, deletedAt: null },
      include: ROLE_WITH_PERMISSIONS,
    });
    if (!user) throw new UnauthorizedException();
    return this.toAuthUser(user);
  }

  /**
   * Change the caller's own password.
   *
   * Requires the CURRENT password. An access token alone must not suffice:
   * otherwise a stolen token converts into permanent account takeover, and the
   * token itself is the thing most likely to have leaked.
   *
   * Every OTHER session is revoked — if the change is a response to a
   * compromise, leaving the attacker signed in would defeat the point — while
   * the calling session survives, so the user is not ejected from the tab they
   * are working in.
   *
   * `currentFamilyId` is the family the caller presented. Null (a native client
   * with no cookie, or an unreadable one) means every family is revoked,
   * including theirs: the safe reading of "I cannot tell which session is
   * yours" is to end them all.
   */
  async changePassword(
    principal: RequestUser,
    input: ChangePasswordInput,
    currentFamilyId: string | null,
    ctx: AuthContext = {},
  ): Promise<{ revoked: number }> {
    const db = this.prisma.forTenant(principal.tenantId);

    const user = await db.user.findFirst({
      where: { id: principal.userId, deletedAt: null, active: true },
    });
    if (!user) {
      this.event('change_password.user_not_active', ctx, {
        tenantId: principal.tenantId,
        userId: principal.userId,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      this.event('change_password.wrong_current', ctx, {
        tenantId: principal.tenantId,
        userId: principal.userId,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const check = validatePassword(input.newPassword, {
      name: user.name,
      email: user.email,
      username: user.username,
    });
    if (!check.ok) {
      throw codedBadRequest(
        'WEAK_PASSWORD',
        PASSWORD_FAILURE_MESSAGE[check.reason],
      );
    }

    // Hashed BEFORE the transaction opens: argon2 costs ~50ms and must not
    // hold a row lock for the duration.
    const passwordHash = await hashPassword(input.newPassword);

    // One transaction: the credential change and the session revocation must
    // not be separable. A crash between them would leave old sessions live on
    // a password the user believes they have already replaced.
    const revoked = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: principal.userId },
        data: { passwordHash, mustChangePassword: false },
      });
      const res = await tx.refreshToken.updateMany({
        where: {
          userId: principal.userId,
          revokedAt: null,
          ...(currentFamilyId ? { familyId: { not: currentFamilyId } } : {}),
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'self_password_change',
        },
      });
      return res.count;
    });

    this.event('change_password.succeeded', ctx, {
      tenantId: principal.tenantId,
      userId: principal.userId,
      revoked,
    });
    return { revoked };
  }

  /**
   * Best-effort family id from a presented refresh token, for
   * {@link changePassword} to know which session belongs to the caller.
   *
   * Returns null rather than throwing when the token is unreadable: the caller
   * then revokes every family, which is the safe direction. This deliberately
   * does NOT grant any authority — the principal has already been established
   * by the access token.
   */
  async familyIdFromToken(token: string): Promise<string | null> {
    try {
      const claims = await this.jwt.verifyAsync<JwtRefreshClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      return claims.typ === 'refresh' ? (claims.fid ?? null) : null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------ internals

  /** Count a failed attempt and lock the account once the threshold is hit. */
  private async recordFailure(
    db: ReturnType<PrismaService['forTenant']>,
    userId: string,
    current: number,
  ): Promise<void> {
    const attempts = current + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS;
    await db.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: lock ? 0 : attempts,
        lockedUntil: lock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : undefined,
      },
    });
  }

  /** Revoke every unrevoked token in a rotation family. Returns rows affected. */
  private async revokeFamily(
    db: ReturnType<PrismaService['forTenant']>,
    familyId: string,
    reason: string,
  ): Promise<number> {
    const res = await db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return res.count;
  }

  /** Begin a brand new rotation family (a fresh login). */
  private async startSession(
    tenantId: string,
    userId: string,
    roleId: string,
    client: AuthClient,
    ctx: AuthContext,
  ): Promise<IssuedSession> {
    const db = this.prisma.forTenant(tenantId);
    const { session } = await this.issueInFamily(
      db,
      tenantId,
      userId,
      roleId,
      randomUUID(),
      client,
      ctx,
    );
    return session;
  }

  /** Issue an access + refresh pair inside an existing family, persisting the jti. */
  private async issueInFamily(
    db: ReturnType<PrismaService['forTenant']>,
    tenantId: string,
    userId: string,
    roleId: string,
    familyId: string,
    client: AuthClient,
    ctx: AuthContext,
  ): Promise<{ jti: string; session: IssuedSession }> {
    const jti = randomUUID();
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    const expiresAt = new Date(Date.now() + durationMs(refreshTtl));

    const accessToken = await this.jwt.signAsync(
      { sub: userId, tid: tenantId, roleId, typ: 'access' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl as unknown as number,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      {
        sub: userId,
        tid: tenantId,
        typ: 'refresh',
        jti,
        fid: familyId,
        cli: client,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl as unknown as number,
      },
    );

    await db.refreshToken.create({
      data: {
        id: jti,
        tenantId,
        userId,
        familyId,
        expiresAt,
        ip: ctx.ip ?? null,
        // Bounded: a hostile client can send a very long User-Agent.
        userAgent: ctx.userAgent?.slice(0, 512) ?? null,
      },
    });

    return {
      jti,
      session: {
        accessToken,
        refreshTokenValue: refreshToken,
        refreshExpiresAt: expiresAt,
        expiresIn: Math.floor(durationMs(accessTtl) / 1000),
      },
    };
  }

  /** Structured auth telemetry. Never receives a password, hash, or token. */
  private event(
    event: string,
    ctx: AuthContext,
    data: Record<string, unknown>,
  ): void {
    this.log.log(
      JSON.stringify({
        event,
        ip: ctx.ip ?? null,
        requestId: ctx.requestId ?? null,
        ...data,
      }),
    );
  }

  private toAuthUser(user: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    username: string;
    roleId: string;
    mustChangePassword?: boolean;
    role?: {
      name: string;
      permissions?: { permission: { key: string } }[];
    } | null;
  }): AuthUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      username: user.username,
      roleId: user.roleId,
      role: user.role?.name ?? null,
      // Resolved server-side and handed to the client so it can avoid
      // rendering controls that would 403. Authorization itself is still
      // decided by PermissionsGuard on every request.
      permissions: user.role?.permissions?.map((rp) => rp.permission.key) ?? [],
      mustChangePassword: user.mustChangePassword ?? false,
    };
  }
}

/**
 * Parse a JWT-style duration ('15m', '7d', '900s', or a bare seconds count)
 * into milliseconds. Needed because the refresh row's expiry must match the
 * token's own expiry exactly — a mismatch either revokes early or leaves a
 * usable row behind a dead token.
 */
export function durationMs(ttl: string): number {
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(ttl.trim());
  if (!m) throw new Error(`Unsupported TTL format: "${ttl}"`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 'ms':
      return n;
    case 's':
    case undefined:
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    default:
      throw new Error(`Unsupported TTL unit in "${ttl}"`);
  }
}
