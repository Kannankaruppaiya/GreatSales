import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  LoginSchema,
  RefreshSchema,
  type LoginInput,
  type RefreshInput,
  type RequestUser,
} from '@greatsales/shared';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Req() req: Request,
  ) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : undefined) ?? req.ip;
    return this.auth.login(body, ip);
  }

  @Public()
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput) {
    return this.auth.refresh(body);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user);
  }
}
