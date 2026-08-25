import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PermissionsGuard } from '../common/permissions.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthService is needed so an administrative write can revoke the target's
  // sessions inside its own transaction.
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, PermissionsGuard],
})
export class UsersModule {}
