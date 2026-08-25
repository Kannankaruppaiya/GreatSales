import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DashboardQuerySchema,
  type DashboardQuery,
  type RequestUser,
} from '@greatsales/shared';
import { DashboardService } from './dashboard.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * The dashboard aggregate. One request replaces what the console previously
 * assembled by paging every lead in the tenant and reducing them in the
 * browser.
 *
 * Gated by `projection.read`: the page is mostly the recurring worksheet's
 * numbers, and every role that can open the console holds it. A sales user is
 * scoped to their own rows by the services underneath, not by this guard.
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @RequirePermissions('projection.read')
  overview(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(DashboardQuerySchema)) query: DashboardQuery,
  ) {
    return this.service.overview(user, query);
  }
}
