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
  MappingCreateSchema,
  MappingListQuerySchema,
  MappingUpdateSchema,
  type MappingCreate,
  type MappingListQuery,
  type MappingUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { MappingsService } from './mappings.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Customer x product mappings — the input to the projections worksheet.
 *
 * Gated by the projection keys rather than a dedicated one: a mapping exists to
 * be projected, and the people who maintain the worksheet are the ones who
 * maintain its inputs. Unlike products (admin-only master data), a sales user
 * maintains the mappings for their own customers, so `projection.write` is
 * correct rather than `user.manage`.
 */
@ApiTags('mappings')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('mappings')
export class MappingsController {
  constructor(private readonly service: MappingsService) {}

  /** Cursor-paginated list. A sales user sees only what they own. */
  @Get()
  @RequirePermissions('projection.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(MappingListQuerySchema))
    query: MappingListQuery,
  ) {
    return this.service.list(user, query);
  }

  /** Map a product to a customer. */
  @Post()
  @RequirePermissions('projection.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(MappingCreateSchema)) body: MappingCreate,
  ) {
    return this.service.create(user, body);
  }

  /** Change the agreed price, or (admin only) the owner. */
  @Patch(':id')
  @RequirePermissions('projection.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MappingUpdateSchema)) body: MappingUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  /** Soft-delete. Refused while projection lines still depend on it. */
  @Delete(':id')
  @RequirePermissions('projection.write')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
