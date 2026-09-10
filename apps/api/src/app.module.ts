import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { RolesModule } from './roles/roles.module';
import { TeamsModule } from './teams/teams.module';
import { ProductsModule } from './products/products.module';
import { FollowUpsModule } from './followups/followups.module';
import { MappingsModule } from './mappings/mappings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RemarksModule } from './remarks/remarks.module';
import { PeriodLocksModule } from './period-locks/period-locks.module';
import { TargetsModule } from './targets/targets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { ImportsModule } from './imports/imports.module';
import { ManagementsModule } from './managements/managements.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Baseline request throttling. Auth routes override this with a much
    // tighter budget (see AuthController). Storage is in-process, so the limit
    // is PER INSTANCE — documented in SECURITY.md; the instance-independent
    // brute-force control is the per-account lockout in AuthService.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    ProjectionsModule,
    CustomersModule,
    LeadsModule,
    OrdersModule,
    PaymentsModule,
    UsersModule,
    RolesModule,
    TeamsModule,
    ProductsModule,
    FollowUpsModule,
    MappingsModule,
    DashboardModule,
    RemarksModule,
    PeriodLocksModule,
    TargetsModule,
    NotificationsModule,
    FeatureFlagsModule,
    ImportsModule,
    ManagementsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
