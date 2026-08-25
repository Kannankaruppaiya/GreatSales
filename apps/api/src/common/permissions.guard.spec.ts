import '../load-env';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey, RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermissions } from './decorators';

/** ExecutionContext double that carries a fixed handler + req.user. */
function ctxFor(handler: unknown, user: RequestUser): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const acmeAdmin: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
};
const acmeMgr: RequestUser = {
  userId: 'user_mgr_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_mgmt_acme',
};

describe('PermissionsGuard (integration)', () => {
  let prisma: PrismaService;
  let guard: PermissionsGuard;

  // A handler annotated as needing projection.write.
  class Ctrl {
    @RequirePermissions('projection.write' as PermissionKey)
    write() {}
    unannotated() {}
  }
  // `unbound-method` guards against detaching a method that needs `this`.
  // These two are empty stubs used ONLY as identity keys for the decorator
  // metadata the Reflector reads — they are never invoked, so there is no
  // `this` to lose. Rebinding them would create new function objects and the
  // metadata lookup would miss.
  /* eslint-disable @typescript-eslint/unbound-method */
  const writeHandler = Ctrl.prototype.write;
  const openHandler = Ctrl.prototype.unannotated;
  /* eslint-enable @typescript-eslint/unbound-method */

  beforeAll(async () => {
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    guard = new PermissionsGuard(new Reflector(), prisma);
  }, 60_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('allows a role that holds the required permission', async () => {
    await expect(
      guard.canActivate(ctxFor(writeHandler, acmeAdmin)),
    ).resolves.toBe(true);
  });

  it('rejects a role that lacks the required permission', async () => {
    await expect(
      guard.canActivate(ctxFor(writeHandler, acmeMgr)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows any authenticated user on an unannotated handler', async () => {
    await expect(guard.canActivate(ctxFor(openHandler, acmeMgr))).resolves.toBe(
      true,
    );
  });
});
