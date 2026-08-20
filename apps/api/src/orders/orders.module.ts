import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, PermissionsGuard],
})
export class OrdersModule {}
