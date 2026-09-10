import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ImportCustomersSchema,
  ImportJobListQuerySchema,
  type ImportCustomers,
  type ImportJobListQuery,
  type RequestUser,
} from '@greatsales/shared';
import { ImportsService } from './imports.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Bulk import.
 *
 * `customer.write` is the key, because that is exactly what this does — it
 * writes customers, in bulk. Anyone who may add one by hand may add four
 * hundred, and inventing a separate permission would mean an admin who can
 * create accounts is refused the fast way of doing it.
 *
 * The `bulk-import` feature flag is checked in the service rather than here: a
 * workspace without the feature must still be able to READ the history of
 * imports it ran before the flag changed.
 */
@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('imports')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  /** Recent import runs, newest first. */
  @Get()
  @RequirePermissions('customer.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(ImportJobListQuerySchema))
    query: ImportJobListQuery,
  ) {
    return this.service.list(user, query);
  }

  @Post('customers')
  @RequirePermissions('customer.write')
  importCustomers(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(ImportCustomersSchema)) body: ImportCustomers,
  ) {
    return this.service.importCustomers(user, body);
  }
}
