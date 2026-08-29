import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import {
  CreateManagementSchema,
  REFRESH_COOKIE,
  type CreateManagementInput,
} from '@greatsales/shared';
import { ManagementsService } from './managements.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PlatformAuthGuard } from './platform-auth.guard';
import { durationMs } from '../auth/auth.service';
import {
  CurrentPlatformUser,
  RequirePlatformRole,
  type PlatformPrincipal,
} from './platform.decorators';
import { Public } from '../common/decorators';
import { AllowPasswordChangePending } from '../common/must-change-password.guard';

/**
 * Owner-facing management operations. Guarded by {@link PlatformAuthGuard}, and
 * opted out of the tenant guard chain with @Public()/@AllowPasswordChangePending().
 *
 */
@ApiTags('platform-managements')
@ApiBearerAuth()
@Public()
@AllowPasswordChangePending()
@UseGuards(PlatformAuthGuard)
@Controller('platform/managements')
export class ManagementsController {
  constructor(
    private readonly service: ManagementsService,
    private readonly config: ConfigService,
  ) {}

  /** Every management with headline stats — the owner's Home grid. */
  @Get()
  list() {
    return this.service.list();
  }

  /** Provision a new management. Owner roles only. */
  @RequirePlatformRole('SuperAdmin', 'Ops')
  @Post()
  create(
    @CurrentPlatformUser() principal: PlatformPrincipal,
    @Body(new ZodValidationPipe(CreateManagementSchema))
    body: CreateManagementInput,
    @Req() req: Request,
  ) {
    return this.service.create(principal, body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Open a management — the token-exchange. Returns an ordinary tenant login
   * response (access token in body, refresh token in the same httpOnly cookie
   * the tenant auth uses), so the web app switches into the management with no
   * special handling. Owner roles only.
   */
  @RequirePlatformRole('SuperAdmin', 'Ops')
  @HttpCode(200)
  @Post(':id/assume')
  async assume(
    @CurrentPlatformUser() principal: PlatformPrincipal,
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.assume(principal, id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(REFRESH_COOKIE, result.refreshTokenValue, this.cookieOptions());

    // Allowlist the body — never let the refresh token reach it.
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  /** Mirrors AuthController.cookieOptions so the assumed session refreshes normally. */
  private cookieOptions(): CookieOptions {
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    const isDev =
      (this.config.get<string>('NODE_ENV') ?? 'development') === 'development';
    return {
      httpOnly: true,
      secure: !isDev,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: durationMs(refreshTtl),
    };
  }
}
