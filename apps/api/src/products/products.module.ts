import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { PrincipalsController } from './principals.controller';
import { ProductsService } from './products.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [ProductsController, PrincipalsController],
  providers: [ProductsService, PermissionsGuard],
  exports: [ProductsService],
})
export class ProductsModule {}
