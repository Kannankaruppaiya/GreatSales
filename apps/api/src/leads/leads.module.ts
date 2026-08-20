import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, PermissionsGuard],
})
export class LeadsModule {}
