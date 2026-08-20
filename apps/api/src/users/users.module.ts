import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PermissionsGuard],
})
export class UsersModule {}
