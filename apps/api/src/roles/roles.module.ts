import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PermissionsGuard } from '../common/permissions.guard';
import { AuthModule } from '../auth/auth.module';

/**
 * AuthModule is imported so a grant change can end the sessions of everyone
 * holding that role — the access token carries roleId, so a narrowed role
 * would otherwise take effect only at token expiry.
 */
@Module({
  imports: [AuthModule],
  controllers: [RolesController],
  providers: [RolesService, PermissionsGuard],
})
export class RolesModule {}
