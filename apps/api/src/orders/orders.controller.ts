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
  OrderCreateSchema,
  OrderListQuerySchema,
  OrderUpdateSchema,
  type OrderCreate,
  type OrderListQuery,
  type OrderUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { OrdersService } from './orders.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  /** Cursor-paginated order list, scoped by tenant + role. */
  @Get()
  @RequirePermissions('order.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(OrderListQuerySchema)) query: OrderListQuery,
  ) {
    return this.service.list(user, query);
  }

  /** Create an order with its line items (total computed server-side). */
  @Post()
  @RequirePermissions('order.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(OrderCreateSchema)) body: OrderCreate,
  ) {
    return this.service.create(user, body);
  }

  /** Scalar edit and/or status transition on one order. */
  @Patch(':id')
  @RequirePermissions('order.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OrderUpdateSchema)) body: OrderUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  /** Soft-delete one order. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('order.write')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
