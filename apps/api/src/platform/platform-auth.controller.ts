import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import {
  PlatformLoginSchema,
  PLATFORM_REFRESH_COOKIE,
  type PlatformLoginInput,
  type PlatformLoginResponse,
} from '@greatsales/shared';
import {
  PlatformAuthService,
  type PlatformSession,
} from './platform-auth.service';
import { PlatformAuthGuard } from './platform-auth.guard';
import {
  CurrentPlatformUser,
  type PlatformPrincipal,
} from './platform.decorators';
import { durationMs } from '../auth/auth.service';
import { Public } from '../common/decorators';
import { AllowPasswordChangePending } from '../common/must-change-password.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Platform (owner) auth. @Public() + @AllowPasswordChangePending() opt every
 * route out of the TENANT guard chain; the platform routes are protected by
 * {@link PlatformAuthGuard} instead (applied per-route, since /login and
 * /refresh must be reachable without a valid access token).
 */
@ApiTags('platform-auth')
@Public()
@AllowPasswordChangePending()
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly auth: PlatformAuthService,
    private readonly config: ConfigService,
  ) {}

  /** Sign in as a platform user. Throttled like the tenant login. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(PlatformLoginSchema)) body: PlatformLoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PlatformLoginResponse> {
    const session = await this.auth.login(body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return this.deliver(session, res);
  }

  /**
   * Rotate the platform session from the httpOnly refresh cookie. This is what
   * lets an owner reload the Home/switcher without being signed out.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PlatformLoginResponse> {
    const jar = req.cookies as Record<string, string> | undefined;
    const token = jar?.[PLATFORM_REFRESH_COOKIE];
    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('No platform session');
    }
    let session: PlatformSession;
    try {
      session = await this.auth.refresh(token);
    } catch (err) {
      res.clearCookie(PLATFORM_REFRESH_COOKIE, this.cookieOptions(0));
      throw err;
    }
    return this.deliver(session, res);
  }

  /** Sign out of the platform surface — clears the refresh cookie. */
  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(PLATFORM_REFRESH_COOKIE, this.cookieOptions(0));
    return { ok: true };
  }

  @ApiBearerAuth()
  @UseGuards(PlatformAuthGuard)
  @Get('me')
  me(@CurrentPlatformUser() principal: PlatformPrincipal) {
    return this.auth.me(principal);
  }

  // ------------------------------------------------------------------ helpers

  /** Set the refresh cookie and return the body without the refresh token. */
  private deliver(
    session: PlatformSession,
    res: Response,
  ): PlatformLoginResponse {
    res.cookie(
      PLATFORM_REFRESH_COOKIE,
      session.refreshTokenValue,
      this.cookieOptions(),
    );
    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      platformUser: session.platformUser,
    };
  }

  /** Mirrors AuthController.cookieOptions, scoped to the platform auth path. */
  private cookieOptions(maxAgeMs?: number): CookieOptions {
    const isDev =
      (this.config.get<string>('NODE_ENV') ?? 'development') === 'development';
    return {
      httpOnly: true,
      secure: !isDev,
      sameSite: 'lax',
      path: '/api/v1/platform/auth',
      maxAge: maxAgeMs ?? durationMs('12h'),
    };
  }
}
