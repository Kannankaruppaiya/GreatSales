import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '@greatsales/shared';
import { FeatureFlagsService } from './feature-flags.service';
import { CurrentUser } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';

/**
 * Which features this workspace has, already resolved.
 *
 * No permission key: every signed-in user needs this, because it decides what
 * the UI is allowed to offer them. It says nothing about the workspace beyond
 * which features it is on — no rollout percentages, no other tenants.
 *
 * Read only. The flags themselves belong to the platform operator and the
 * database enforces that: the app's role has INSERT, UPDATE and DELETE revoked
 * on both flag tables.
 */
@ApiTags('feature-flags')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly service: FeatureFlagsService) {}

  @Get()
  resolve(@CurrentUser() user: RequestUser) {
    return this.service.resolve(user.tenantId);
  }
}
