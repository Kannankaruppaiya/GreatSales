import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [ImportsController],
  providers: [ImportsService, PermissionsGuard],
})
export class ImportsModule {}
