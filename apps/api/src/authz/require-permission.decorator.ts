import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@greatsales/shared';

/**
 * Declares the permission(s) a route requires. Enforced by PermissionsGuard,
 * which runs after the (global) JWT guard has attached `req.user`. Multiple
 * keys are ALL required (AND).
 */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermission = (...keys: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, keys);
