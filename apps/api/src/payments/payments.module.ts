import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PermissionsGuard],
  // Exported for ExportModule — see CustomersModule's export for why.
  exports: [PaymentsService],
})
export class PaymentsModule {}
