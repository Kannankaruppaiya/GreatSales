import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { IndustriesController } from './industries.controller';

@Module({
  controllers: [CustomersController, IndustriesController],
  providers: [CustomersService],
})
export class CustomersModule {}
