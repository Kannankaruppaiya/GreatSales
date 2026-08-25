import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MustChangePasswordGuard } from '../common/must-change-password.guard';

/**
 * Secrets are passed per-sign/verify call (access vs refresh use different
 * secrets), so JwtModule is registered empty. Registering JwtAuthGuard as
 * APP_GUARD makes authentication the default for every route; opt out with
 * @Public().
 *
 * MustChangePasswordGuard follows it, making "this user must replace an
 * admin-set password" a default deny for every route; opt out with
 * @AllowPasswordChangePending().
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    // ORDER MATTERS. Nest applies APP_GUARD providers in registration order,
    // and MustChangePasswordGuard reads `req.user`, which JwtAuthGuard sets.
    // Registered here rather than in AppModule so the two stay adjacent: if
    // the password gate ran first it would see no principal and fail OPEN,
    // letting a flagged user straight through.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
  ],
  // Exported so UsersService can end a user's sessions inside its own
  // transaction when it deactivates, deletes, or re-credentials them.
  exports: [AuthService],
})
export class AuthModule {}
