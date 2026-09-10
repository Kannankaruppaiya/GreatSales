import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { CustomersController } from './customers.controller';
import { IndustriesController } from './industries.controller';
import { CustomersService } from './customers.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  imports: [NotificationsModule, FeatureFlagsModule],
  controllers: [CustomersController, IndustriesController],
  providers: [CustomersService, PermissionsGuard],
})
export class CustomersModule {}
