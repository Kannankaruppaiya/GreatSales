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
  CustomerContactCreateSchema,
  CustomerContactUpdateSchema,
  CustomerCreateSchema,
  CustomerListQuerySchema,
  CustomerUpdateSchema,
  type CustomerContactCreate,
  type CustomerContactUpdate,
  type CustomerCreate,
  type CustomerListQuery,
  type CustomerUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { CustomersService } from './customers.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  /** Cursor-paginated customer list, scoped by tenant + role. */
  @Get()
  @RequirePermissions('customer.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(CustomerListQuerySchema))
    query: CustomerListQuery,
  ) {
    return this.service.list(user, query);
  }

  /** Create a customer. */
  @Post()
  @RequirePermissions('customer.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CustomerCreateSchema)) body: CustomerCreate,
  ) {
    return this.service.create(user, body);
  }

  /** Partial edit on one customer. */
  @Patch(':id')
  @RequirePermissions('customer.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CustomerUpdateSchema)) body: CustomerUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  /** Soft-delete one customer. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('customer.write')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  // --- Contacts sub-resource (/customers/:customerId/contacts) -------------

  /** List a customer's contacts (primary first). */
  @Get(':customerId/contacts')
  @RequirePermissions('customer.read')
  listContacts(
    @CurrentUser() user: RequestUser,
    @Param('customerId') customerId: string,
  ) {
    return this.service.listContacts(user, customerId);
  }

  /** Add a contact to a customer. */
  @Post(':customerId/contacts')
  @RequirePermissions('customer.write')
  createContact(
    @CurrentUser() user: RequestUser,
    @Param('customerId') customerId: string,
    @Body(new ZodValidationPipe(CustomerContactCreateSchema))
    body: CustomerContactCreate,
  ) {
    return this.service.createContact(user, customerId, body);
  }

  /** Edit one contact (or promote it to primary). */
  @Patch(':customerId/contacts/:contactId')
  @RequirePermissions('customer.write')
  updateContact(
    @CurrentUser() user: RequestUser,
    @Param('customerId') customerId: string,
    @Param('contactId') contactId: string,
    @Body(new ZodValidationPipe(CustomerContactUpdateSchema))
    body: CustomerContactUpdate,
  ) {
    return this.service.updateContact(user, customerId, contactId, body);
  }

  /** Delete one contact (promotes the next oldest if it was primary). */
  @Delete(':customerId/contacts/:contactId')
  @HttpCode(204)
  @RequirePermissions('customer.write')
  removeContact(
    @CurrentUser() user: RequestUser,
    @Param('customerId') customerId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.service.removeContact(user, customerId, contactId);
  }
}
