import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Secrets are passed per-sign/verify call (access vs refresh use different
 * secrets), so JwtModule is registered empty. Registering JwtAuthGuard as
 * APP_GUARD makes authentication the default for every route; opt out with
 * @Public().
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule {}
