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
  FollowUpCreateSchema,
  FollowUpListQuerySchema,
  FollowUpUpdateSchema,
  type FollowUpCreate,
  type FollowUpListQuery,
  type FollowUpUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { FollowUpsService } from './followups.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Cross-entity follow-up tasks. RBAC has no dedicated key: reads are gated by
 * `projection.read`, writes by `projection.write` (the roles that act on the
 * pipeline act on its follow-ups). The table has no soft-delete column, so
 * DELETE removes the row.
 */
@ApiTags('followups')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('followups')
export class FollowUpsController {
  constructor(private readonly service: FollowUpsService) {}

  /** Cursor-paginated follow-up list, scoped by tenant + role. */
  @Get()
  @RequirePermissions('projection.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(FollowUpListQuerySchema))
    query: FollowUpListQuery,
  ) {
    return this.service.list(user, query);
  }

  /** Create a follow-up. */
  @Post()
  @RequirePermissions('projection.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(FollowUpCreateSchema)) body: FollowUpCreate,
  ) {
    return this.service.create(user, body);
  }

  /** Partial edit on one follow-up (commonly to mark done). */
  @Patch(':id')
  @RequirePermissions('projection.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FollowUpUpdateSchema)) body: FollowUpUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  /** Delete one follow-up. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('projection.write')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
