import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Builds a real AuthService for the users integration specs.
 *
 * UsersService depends on AuthService to revoke a target's sessions inside its
 * own transaction. The specs use the REAL service against the REAL database
 * rather than a stub, because "the session is actually gone" is the thing
 * under test — a stub would prove only that a method was called.
 *
 * Test-only. Nothing in the production path imports this; Nest wires the same
 * dependency through AuthModule.
 */
export function makeAuthService(prisma: PrismaService): AuthService {
  return new AuthService(
    prisma,
    new JwtService({}),
    new ConfigService({
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
      NODE_ENV: 'test',
    }),
  );
}
