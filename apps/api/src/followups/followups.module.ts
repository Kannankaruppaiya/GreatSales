import { Module } from '@nestjs/common';
import { FollowUpsController } from './followups.controller';
import { FollowUpsService } from './followups.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [FollowUpsController],
  providers: [FollowUpsService, PermissionsGuard],
  // The dashboard composes this service so its follow-up card counts the
  // same rows this page lists, instead of a second query that could disagree.
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
