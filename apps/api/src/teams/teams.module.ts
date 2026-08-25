import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, PermissionsGuard],
})
export class TeamsModule {}
