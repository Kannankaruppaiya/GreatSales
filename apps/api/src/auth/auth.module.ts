import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';

/**
 * Secrets are passed per-sign/verify call (access vs refresh use different
 * secrets), so JwtModule is registered empty. Two global guards run in order:
 * JwtAuthGuard authenticates (populates req.user) and PermissionsGuard
 * authorizes against @RequirePermissions. Authentication is the default for
 * every route; opt out with @Public().
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [PermissionsGuard],
})
export class AuthModule {}
