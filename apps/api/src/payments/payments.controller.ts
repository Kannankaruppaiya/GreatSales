import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AddPaymentFollowupSchema,
  CreatePaymentSchema,
  CursorPageQuerySchema,
  UpdatePaymentSchema,
  type AddPaymentFollowupInput,
  type CreatePaymentInput,
  type CursorPageQuery,
  type RequestUser,
  type UpdatePaymentInput,
} from '@greatsales/shared';
import { CurrentUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions } from '../auth/permissions.guard';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermissions('payment.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(CursorPageQuerySchema)) query: CursorPageQuery,
  ) {
    return this.payments.list(user, query);
  }

  @Get(':id')
  @RequirePermissions('payment.read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.payments.get(user, id);
  }

  @Post()
  @RequirePermissions('payment.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreatePaymentSchema)) body: CreatePaymentInput,
  ) {
    return this.payments.create(user, body);
  }

  @Patch(':id')
  @RequirePermissions('payment.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePaymentSchema)) body: UpdatePaymentInput,
  ) {
    return this.payments.update(user, id, body);
  }

  @Post(':id/followups')
  @RequirePermissions('payment.write')
  addFollowup(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddPaymentFollowupSchema))
    body: AddPaymentFollowupInput,
  ) {
    return this.payments.addFollowup(user, id, body);
  }
}
