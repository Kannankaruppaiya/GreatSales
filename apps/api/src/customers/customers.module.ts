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
  // Exported for ExportModule: the tenant export composes this service
  // rather than re-querying Customer directly, so it stays scoped and
  // filtered exactly like the Customers page.
  exports: [CustomersService],
})
export class CustomersModule {}
