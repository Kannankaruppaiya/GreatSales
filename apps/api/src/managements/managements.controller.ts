import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '@greatsales/shared';
import { ManagementsService } from './managements.service';
import { CurrentUser } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';

/**
 * The workspaces the caller can reach. No permission key: every authenticated
 * user must be able to read the name and plan of the workspace they are in.
 *
 * There is no POST/PATCH/DELETE — see ManagementsService for why the runtime
 * role cannot write `Tenant` and why that is deliberate.
 */
@ApiTags('managements')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('managements')
export class ManagementsController {
  constructor(private readonly service: ManagementsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.service.list(user);
  }
}
