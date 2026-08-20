import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectionsModule } from './projections/projections.module';
import { CustomersModule } from './customers/customers.module';
import { LeadsModule } from './leads/leads.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { FollowUpsModule } from './followups/followups.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    ProjectionsModule,
    CustomersModule,
    LeadsModule,
    OrdersModule,
    PaymentsModule,
    UsersModule,
    ProductsModule,
    FollowUpsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
