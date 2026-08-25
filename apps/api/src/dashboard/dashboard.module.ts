import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ProjectionsModule } from '../projections/projections.module';
import { LeadsModule } from '../leads/leads.module';
import { PermissionsGuard } from '../common/permissions.guard';

/**
 * Composes the projections and leads modules rather than querying their tables
 * directly, so the dashboard cannot drift from the pages it summarises.
 */
@Module({
  imports: [ProjectionsModule, LeadsModule],
  controllers: [DashboardController],
  providers: [DashboardService, PermissionsGuard],
})
export class DashboardModule {}
