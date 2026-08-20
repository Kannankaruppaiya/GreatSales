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
  ProductCreateSchema,
  ProductListQuerySchema,
  ProductUpdateSchema,
  type ProductCreate,
  type ProductListQuery,
  type ProductUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { ProductsService } from './products.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Catalog master data. RBAC has no dedicated product key: reads are gated by
 * `order.read` (every role needs catalog visibility), writes by `user.manage`
 * (admin-only maintenance).
 */
@ApiTags('products')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  /** Cursor-paginated catalog list. */
  @Get()
  @RequirePermissions('order.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(ProductListQuerySchema))
    query: ProductListQuery,
  ) {
    return this.service.list(user, query);
  }

  /** Create a catalog product. */
  @Post()
  @RequirePermissions('user.manage')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(ProductCreateSchema)) body: ProductCreate,
  ) {
    return this.service.create(user, body);
  }

  /** Partial edit on one product. */
  @Patch(':id')
  @RequirePermissions('user.manage')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProductUpdateSchema)) body: ProductUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  /** Soft-delete one product. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('user.manage')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
