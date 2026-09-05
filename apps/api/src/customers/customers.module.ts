import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { IndustriesController } from './industries.controller';
import { CustomersService } from './customers.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [CustomersController, IndustriesController],
  providers: [CustomersService, PermissionsGuard],
})
export class CustomersModule {}
