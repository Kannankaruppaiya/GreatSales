import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { ROLE_PERMISSIONS, PERMISSION_KEYS } from '@greatsales/shared';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from './decorators';

/**
 * The grant table is the authority for what each system role may do. These
 * assertions are deliberately literal: a future edit that widens the sales
 * role must fail here and be argued for, not slip through.
 */
describe('ROLE_PERMISSIONS grants', () => {
  it('never grants sales the admin permissions', () => {
    expect(ROLE_PERMISSIONS.sales).not.toContain('user.manage');
    expect(ROLE_PERMISSIONS.sales).not.toContain('role.manage');
  });

  it('never grants management any write permission', () => {
    const writes = ROLE_PERMISSIONS.mgmt.filter((k) => k.endsWith('.write'));
    expect(writes).toEqual([]);
  });

  it('grants sales the catalog read used by the projections worksheet', () => {
    // products + principals list routes both require 'order.read'
    expect(ROLE_PERMISSIONS.sales).toContain('order.read');
  });

  it('grants admin every permission', () => {
    expect([...ROLE_PERMISSIONS.admin].sort()).toEqual(
      [...PERMISSION_KEYS].sort(),
    );
  });
});

/** ExecutionContext double that carries a fixed handler + req.user. */
function ctxFor(handler: unknown, user: RequestUser): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard denies sales the users module', () => {
  const salesUser: RequestUser = {
    userId: 'user_sales1_acme',
    tenantId: 'tenant_acme',
    roleId: 'role_sales_acme',
  };

  it('rejects a user.manage route for a sales caller', async () => {
    const handler = () => {};
    Reflect.defineMetadata(PERMISSIONS_KEY, ['user.manage'], handler);

    const prismaStub = {
      forTenant: () => ({
        role: {
          findUnique: async () => ({
            id: 'role_sales_acme',
            permissions: ROLE_PERMISSIONS.sales.map((key) => ({
              permission: { key },
            })),
          }),
        },
      }),
    };

    const guard = new PermissionsGuard(new Reflector(), prismaStub as never);

    await expect(
      guard.canActivate(ctxFor(handler, salesUser)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
