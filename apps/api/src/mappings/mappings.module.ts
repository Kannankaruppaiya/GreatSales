import { Module } from '@nestjs/common';
import { MappingsController } from './mappings.controller';
import { MappingsService } from './mappings.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [MappingsController],
  providers: [MappingsService, PermissionsGuard],
})
export class MappingsModule {}
