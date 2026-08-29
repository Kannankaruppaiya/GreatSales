import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestUser } from '@greatsales/shared';
import { AuthzService, type PrincipalScope } from './authz.service';
import { PermissionsGuard } from './permissions.guard';

function context(user?: RequestUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function scopeWith(keys: string[]): PrincipalScope {
  const set = new Set(keys);
  return { permissions: set, has: (k) => set.has(k), canSeeAllData: set.has('report.view') };
}

const user: RequestUser = { userId: 'u1', tenantId: 't1', roleId: 'r1' };

describe('PermissionsGuard', () => {
  function makeGuard(required: string[] | undefined, keys: string[]) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector;
    const authz = { getScope: jest.fn().mockResolvedValue(scopeWith(keys)) } as unknown as AuthzService;
    return new PermissionsGuard(reflector, authz);
  }

  it('allows a route with no @RequirePermission (auth alone governs it)', async () => {
    const guard = makeGuard(undefined, []);
    await expect(guard.canActivate(context(user))).resolves.toBe(true);
  });

  it('allows when the principal holds the required permission', async () => {
    const guard = makeGuard(['customer.read'], ['customer.read', 'customer.write']);
    await expect(guard.canActivate(context(user))).resolves.toBe(true);
  });

  it('forbids when a required permission is missing', async () => {
    const guard = makeGuard(['customer.write'], ['customer.read']); // e.g. a manager
    await expect(guard.canActivate(context(user))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when there is no authenticated principal', async () => {
    const guard = makeGuard(['customer.read'], []);
    await expect(guard.canActivate(context(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
