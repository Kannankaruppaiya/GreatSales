import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  imports: [NotificationsModule],
  controllers: [LeadsController],
  providers: [LeadsService, PermissionsGuard],
  // Exported for DashboardModule: the aggregate COMPOSES this service
  // rather than re-querying its tables, so the dashboard cannot drift
  // from the page it summarises.
  exports: [LeadsService],
})
export class LeadsModule {}
