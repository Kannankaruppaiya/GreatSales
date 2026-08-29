import { Global, Module } from '@nestjs/common';
import { AuthzService } from './authz.service';
import { PermissionsGuard } from './permissions.guard';

/**
 * Authorization primitives (AuthzService + PermissionsGuard). Global so any
 * feature module can apply @UseGuards(PermissionsGuard) with @RequirePermission
 * without re-importing. PrismaModule is already @Global.
 */
@Global()
@Module({
  providers: [AuthzService, PermissionsGuard],
  exports: [AuthzService, PermissionsGuard],
})
export class AuthzModule {}
