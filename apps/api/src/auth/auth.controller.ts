import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import {
  ChangePasswordSchema,
  LoginSchema,
  LogoutSchema,
  RefreshSchema,
  REFRESH_COOKIE,
  type AuthTokens,
  type ChangePasswordInput,
  type JwtAccessClaims,
  type LoginInput,
  type LogoutInput,
  type RefreshInput,
  type RequestUser,
} from '@greatsales/shared';
import { AuthService, durationMs, type IssuedSession } from './auth.service';
import { CurrentUser, Public } from '../common/decorators';
import { AllowPasswordChangePending } from '../common/must-change-password.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Sign in.
   *
   * Throttled harder than the rest of the API: 5 attempts per minute from one
   * IP. This is the per-IP layer only — it lives in process memory, so with N
   * API instances an attacker distributing requests gets up to N times the
   * budget. The authoritative, instance-independent control is the per-account
   * lockout in AuthService (AGENTS.md §5, §7).
   */
  @Public()
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 5 : 100,
      ttl: 60_000,
    },
  })
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body, this.ctx(req));

    // Build the response by allowlist rather than by stripping fields off the
    // service result: a field added to IssuedSession later then cannot leak
    // into the body by default. Nothing here is a refresh token.
    const safe = {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };

    if (body.tokenDelivery === 'cookie') {
      res.cookie(
        REFRESH_COOKIE,
        result.refreshTokenValue,
        this.cookieOptions(),
      );
      return safe; // body carries NO refresh token
    }
    return { ...safe, refreshToken: result.refreshTokenValue };
  }

  /**
   * Rotate the session. The refresh token comes from the httpOnly cookie for
   * browser clients, or from the body for clients that cannot hold cookies.
   */
  @Public()
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 20 : 200,
      ttl: 60_000,
    },
  })
  @Post('refresh')
  async refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    const fromCookie = this.cookieToken(req);
    const token = body.refreshToken ?? fromCookie;
    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    let session: IssuedSession;
    try {
      session = await this.auth.refresh(token, this.ctx(req));
    } catch (err) {
      // The presented token is dead. Clear the cookie so the browser stops
      // replaying it on every subsequent request.
      if (fromCookie) res.clearCookie(REFRESH_COOKIE, this.cookieOptions(0));
      throw err;
    }

    // Allowlist again — see login().
    const safe = {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    };

    // Deliver the rotated token the same way it arrived, so a client never
    // silently changes transport mid-session.
    if (!body.refreshToken) {
      res.cookie(
        REFRESH_COOKIE,
        session.refreshTokenValue,
        this.cookieOptions(),
      );
      return safe;
    }
    return { ...safe, refreshToken: session.refreshTokenValue };
  }

  /**
   * Sign out for real — revokes the refresh family server-side.
   *
   * Public because a caller whose access token has already expired must still
   * be able to end their session. `allSessions` additionally requires a valid
   * access token, since revoking every device is a privileged action.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('logout')
  async logout(
    @Body(new ZodValidationPipe(LogoutSchema)) body: LogoutInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = body.refreshToken ?? this.cookieToken(req);
    const principal = body.allSessions ? this.optionalPrincipal(req) : null;
    const result = await this.auth.logout(
      token,
      body.allSessions && !!principal,
      principal,
      this.ctx(req),
    );
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions(0));
    return result;
  }

  /**
   * Change your own password.
   *
   * Authenticated by the global JWT guard AND by proof of the current
   * password. Throttled to blunt an attacker who holds a stolen access token
   * from brute-forcing the current password through this endpoint.
   *
   * Exempt from the forced-password-change gate: it is the only way out of it.
   */
  @ApiBearerAuth()
  @AllowPasswordChangePending()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(ChangePasswordSchema))
    body: ChangePasswordInput,
    @Req() req: Request,
  ) {
    const cookie = this.cookieToken(req);
    const familyId = cookie ? await this.auth.familyIdFromToken(cookie) : null;
    return this.auth.changePassword(user, body, familyId, this.ctx(req));
  }

  @ApiBearerAuth()
  @AllowPasswordChangePending()
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user);
  }

  // ------------------------------------------------------------------ helpers

  private ctx(req: Request) {
    // `req.ip` already honours X-Forwarded-For according to the app's
    // `trust proxy` setting. Parsing the header by hand instead would trust a
    // spoofed value whenever the API is NOT behind a proxy.
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId:
        typeof req.headers['x-request-id'] === 'string'
          ? req.headers['x-request-id']
          : undefined,
    };
  }

  private cookieToken(req: Request): string | undefined {
    // express's own `Request.cookies` is typed `any`; narrow it so the value
    // that becomes a credential is at least a checked string.
    const jar = req.cookies as Record<string, string> | undefined;
    const value: unknown = jar?.[REFRESH_COOKIE];
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Cookie carrying the refresh token.
   *
   * `httpOnly` keeps it out of JavaScript's reach, which is the whole point —
   * an XSS can then call the API as the user but cannot exfiltrate a
   * seven-day credential.
   *
   * `sameSite: 'lax'` + a scoped `path` assume the API is served same-origin
   * with the web app (staging does this: VITE_API_URL="/api/v1"). Local dev
   * goes through the Vite proxy for the same reason. A genuinely cross-site
   * deployment would need SameSite=None, which modern browsers increasingly
   * block for third-party cookies — so keep the API same-origin.
   */
  private cookieOptions(maxAgeMs?: number): CookieOptions {
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    const isDev =
      (this.config.get<string>('NODE_ENV') ?? 'development') === 'development';
    return {
      httpOnly: true,
      secure: !isDev, // dev is plain http://localhost; everywhere else HTTPS-only
      sameSite: 'lax',
      path: '/api/v1/auth', // sent only to the auth endpoints that need it
      maxAge: maxAgeMs ?? durationMs(refreshTtl),
    };
  }

  /**
   * Read the principal from a bearer token if one is present and valid.
   * Returns null rather than throwing — logout must work either way.
   */
  private optionalPrincipal(req: Request): RequestUser | null {
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) return null;
    try {
      const claims = this.jwt.verify<JwtAccessClaims>(header.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (claims.typ !== 'access') return null;
      return {
        userId: claims.sub,
        tenantId: claims.tid,
        roleId: claims.roleId,
      };
    } catch {
      return null;
    }
  }
}
