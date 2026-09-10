import { Module } from '@nestjs/common';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';
import { PermissionsGuard } from '../common/permissions.guard';

/**
 * Exported so the services that own gated writes can ask before writing. A
 * flag checked only in the browser is a suggestion.
 */
@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, PermissionsGuard],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
