import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PermissionsGuard } from '../common/permissions.guard';

/**
 * Exported because the emitters live in the feature services that cause the
 * events — leads, customers, orders, payments — rather than in a listener that
 * would have to re-derive what changed.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, PermissionsGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
