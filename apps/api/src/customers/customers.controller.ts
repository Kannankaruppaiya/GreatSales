import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateCustomerSchema,
  CustomerListQuerySchema,
  UpdateCustomerSchema,
  type CreateCustomerInput,
  type CustomerListQuery,
  type RequestUser,
  type UpdateCustomerInput,
} from '@greatsales/shared';
import { CurrentUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CustomersService } from './customers.service';

/**
 * Customer CRUD. Authenticated (global JWT guard) + authorized
 * (PermissionsGuard reads @RequirePermission). Reads need `customer.read`,
 * writes need `customer.write`. Row-level ownership (own vs. tenant-wide) is
 * enforced in the service.
 */
@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission('customer.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(CustomerListQuerySchema)) query: CustomerListQuery,
  ) {
    return this.customers.list(user, query);
  }

  @Get(':id')
  @RequirePermission('customer.read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.customers.get(user, id);
  }

  @Post()
  @RequirePermission('customer.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateCustomerSchema)) body: CreateCustomerInput,
  ) {
    return this.customers.create(user, body);
  }

  @Patch(':id')
  @RequirePermission('customer.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCustomerSchema)) body: UpdateCustomerInput,
  ) {
    return this.customers.update(user, id, body);
  }

  @Delete(':id')
  @RequirePermission('customer.write')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.customers.remove(user, id);
  }
}
