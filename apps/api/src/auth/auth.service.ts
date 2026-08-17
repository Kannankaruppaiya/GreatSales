import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthTokens,
  AuthUser,
  LoginInput,
  LoginResponse,
  RefreshInput,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from './hash';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Authenticate within a tenant. Every DB read/write here runs under the
   * tenant's RLS scope (forTenant), so a wrong tenantId simply sees no rows.
   * Failures are deliberately indistinguishable ("Invalid credentials") to
   * avoid leaking whether a tenant/email exists.
   */
  async login(input: LoginInput, ip?: string): Promise<LoginResponse> {
    const db = this.prisma.forTenant(input.tenantId);

    const tenant = await db.tenant.findUnique({
      where: { id: input.tenantId },
    });
    if (
      !tenant ||
      tenant.deletedAt ||
      tenant.status === 'Suspended' ||
      tenant.status === 'Churned'
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await db.user.findFirst({
      where: { email: input.email, deletedAt: null, active: true },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastIp: ip ?? null },
    });

    const tokens = await this.issueTokens({
      sub: user.id,
      tid: user.tenantId,
      roleId: user.roleId,
    });
    return { ...tokens, user: this.toAuthUser(user) };
  }

  /** Exchange a valid refresh token for a fresh access + refresh pair. */
  async refresh(input: RefreshInput): Promise<AuthTokens> {
    let claims: { sub: string; tid: string; typ: string };
    try {
      claims = await this.jwt.verifyAsync(input.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (claims.typ !== 'refresh') {
      throw new UnauthorizedException('Wrong token type');
    }

    const db = this.prisma.forTenant(claims.tid);
    const user = await db.user.findFirst({
      where: { id: claims.sub, deletedAt: null, active: true },
    });
    if (!user) throw new UnauthorizedException('User no longer active');

    return this.issueTokens({
      sub: user.id,
      tid: user.tenantId,
      roleId: user.roleId,
    });
  }

  /** Current authenticated user profile. */
  async me(principal: RequestUser): Promise<AuthUser> {
    const db = this.prisma.forTenant(principal.tenantId);
    const user = await db.user.findFirst({
      where: { id: principal.userId, deletedAt: null },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.toAuthUser(user);
  }

  private async issueTokens(base: {
    sub: string;
    tid: string;
    roleId: string;
  }): Promise<AuthTokens> {
    // `expiresIn` is a duration string ('15m'); @nestjs/jwt types it as ms's
    // stricter StringValue union, so widen via unknown at the boundary.
    const accessTtl = (this.config.get<string>('JWT_ACCESS_TTL') ??
      '15m') as unknown as number;
    const refreshTtl = (this.config.get<string>('JWT_REFRESH_TTL') ??
      '7d') as unknown as number;

    const accessToken = await this.jwt.signAsync(
      { sub: base.sub, tid: base.tid, roleId: base.roleId, typ: 'access' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: base.sub, tid: base.tid, typ: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      },
    );
    return { accessToken, refreshToken };
  }

  private toAuthUser(user: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    username: string;
    roleId: string;
    role?: { name: string } | null;
  }): AuthUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      username: user.username,
      roleId: user.roleId,
      role: user.role?.name ?? null,
    };
  }
}
