import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  imports: [NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, PermissionsGuard],
})
export class OrdersModule {}
