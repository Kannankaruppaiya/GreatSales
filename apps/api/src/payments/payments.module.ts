import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PermissionsGuard],
})
export class PaymentsModule {}
