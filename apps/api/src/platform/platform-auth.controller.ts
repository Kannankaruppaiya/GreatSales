import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  PlatformLoginSchema,
  type PlatformLoginInput,
} from '@greatsales/shared';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthGuard } from './platform-auth.guard';
import {
  CurrentPlatformUser,
  type PlatformPrincipal,
} from './platform.decorators';
import { Public } from '../common/decorators';
import { AllowPasswordChangePending } from '../common/must-change-password.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Platform (owner) auth. @Public() + @AllowPasswordChangePending() opt every
 * route out of the TENANT guard chain; the platform routes are protected by
 * {@link PlatformAuthGuard} instead (applied per-route, since /login must be
 * reachable without a token).
 */
@ApiTags('platform-auth')
@Public()
@AllowPasswordChangePending()
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  /** Sign in as a platform user. Throttled like the tenant login. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(
    @Body(new ZodValidationPipe(PlatformLoginSchema)) body: PlatformLoginInput,
    @Req() req: Request,
  ) {
    return this.auth.login(body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @ApiBearerAuth()
  @UseGuards(PlatformAuthGuard)
  @Get('me')
  me(@CurrentPlatformUser() principal: PlatformPrincipal) {
    return this.auth.me(principal);
  }
}
