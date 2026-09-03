import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateCustomerSchema,
  CursorPageQuerySchema,
  UpdateCustomerSchema,
  type CreateCustomerInput,
  type CursorPageQuery,
  type RequestUser,
  type UpdateCustomerInput,
} from '@greatsales/shared';
import { CurrentUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions } from '../auth/permissions.guard';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customer.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(CursorPageQuerySchema)) query: CursorPageQuery,
  ) {
    return this.customers.list(user, query);
  }

  @Get(':id')
  @RequirePermissions('customer.read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.customers.get(user, id);
  }

  @Post()
  @RequirePermissions('customer.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateCustomerSchema))
    body: CreateCustomerInput,
  ) {
    return this.customers.create(user, body);
  }

  @Patch(':id')
  @RequirePermissions('customer.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCustomerSchema))
    body: UpdateCustomerInput,
  ) {
    return this.customers.update(user, id, body);
  }

  @Delete(':id')
  @RequirePermissions('customer.write')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.customers.remove(user, id);
  }
}
