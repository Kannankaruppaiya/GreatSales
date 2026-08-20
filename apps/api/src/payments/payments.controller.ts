import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  PaymentCreateSchema,
  PaymentListQuerySchema,
  PaymentUpdateSchema,
  type PaymentCreate,
  type PaymentListQuery,
  type PaymentUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { PaymentsService } from './payments.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /** Cursor-paginated payment list, scoped by tenant + role. */
  @Get()
  @RequirePermissions('payment.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(PaymentListQuerySchema))
    query: PaymentListQuery,
  ) {
    return this.service.list(user, query);
  }

  /** Create a payment (may be a manual entry with no linked customer). */
  @Post()
  @RequirePermissions('payment.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(PaymentCreateSchema)) body: PaymentCreate,
  ) {
    return this.service.create(user, body);
  }

  /** Partial edit on one payment (re-derives pending/status). */
  @Patch(':id')
  @RequirePermissions('payment.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PaymentUpdateSchema)) body: PaymentUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  /** Soft-delete one payment. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('payment.write')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
