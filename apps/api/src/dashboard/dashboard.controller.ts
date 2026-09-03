import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '@greatsales/shared';
import { CurrentUser } from '../common/decorators';
import { DashboardService } from './dashboard.service';

// Summary is basic tenant-scoped counts every authenticated role (including
// sales, which lacks report.view) needs on the home screen, so it requires
// authentication only — RLS still confines every number to the caller's tenant.
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: RequestUser) {
    return this.dashboard.summary(user);
  }
}
