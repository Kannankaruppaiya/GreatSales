import { Module } from '@nestjs/common';
import { FollowUpsController } from './followups.controller';
import { FollowUpsService } from './followups.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [FollowUpsController],
  providers: [FollowUpsService, PermissionsGuard],
})
export class FollowUpsModule {}
