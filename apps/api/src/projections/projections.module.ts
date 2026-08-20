import { Module } from '@nestjs/common';
import { ProjectionsController } from './projections.controller';
import { ProjectionsService } from './projections.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [ProjectionsController],
  providers: [ProjectionsService, PermissionsGuard],
})
export class ProjectionsModule {}
