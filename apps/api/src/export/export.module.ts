import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { CustomersModule } from '../customers/customers.module';
import { LeadsModule } from '../leads/leads.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProductsModule } from '../products/products.module';
import { PermissionsGuard } from '../common/permissions.guard';

/**
 * Composes the same five entity modules the Data page's export reads from,
 * rather than querying their tables directly — same reason DashboardModule
 * composes ProjectionsModule/LeadsModule: the export cannot drift from the
 * pages it is a bulk read of.
 */
@Module({
  imports: [
    CustomersModule,
    LeadsModule,
    OrdersModule,
    PaymentsModule,
    ProductsModule,
  ],
  controllers: [ExportController],
  providers: [ExportService, PermissionsGuard],
})
export class ExportModule {}
