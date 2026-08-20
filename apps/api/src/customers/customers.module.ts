import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, PermissionsGuard],
})
export class CustomersModule {}
