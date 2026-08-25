import { Module } from '@nestjs/common';
import { ProjectionsController } from './projections.controller';
import { ProjectionsService } from './projections.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [ProjectionsController],
  providers: [ProjectionsService, PermissionsGuard],
  // Exported for DashboardModule: the aggregate COMPOSES this service
  // rather than re-querying its tables, so the dashboard cannot drift
  // from the page it summarises.
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
