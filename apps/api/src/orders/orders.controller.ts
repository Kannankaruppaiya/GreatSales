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
  CreateOrderSchema,
  CursorPageQuerySchema,
  UpdateOrderStatusSchema,
  type CreateOrderInput,
  type CursorPageQuery,
  type RequestUser,
  type UpdateOrderStatusInput,
} from '@greatsales/shared';
import { CurrentUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions } from '../auth/permissions.guard';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions('order.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(CursorPageQuerySchema)) query: CursorPageQuery,
  ) {
    return this.orders.list(user, query);
  }

  @Get(':id')
  @RequirePermissions('order.read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.orders.get(user, id);
  }

  @Post()
  @RequirePermissions('order.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateOrderSchema)) body: CreateOrderInput,
  ) {
    return this.orders.create(user, body);
  }

  @Patch(':id/status')
  @RequirePermissions('order.write')
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOrderStatusSchema))
    body: UpdateOrderStatusInput,
  ) {
    return this.orders.updateStatus(user, id, body);
  }
}
