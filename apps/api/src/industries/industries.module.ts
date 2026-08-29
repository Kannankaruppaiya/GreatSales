import { Module } from '@nestjs/common';
import { IndustriesController } from './industries.controller';
import { IndustriesService } from './industries.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [IndustriesController],
  providers: [IndustriesService, PermissionsGuard],
})
export class IndustriesModule {}
