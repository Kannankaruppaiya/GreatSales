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
  LeadCreateSchema,
  LeadListQuerySchema,
  LeadUpdateSchema,
  type LeadCreate,
  type LeadListQuery,
  type LeadUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { LeadsService } from './leads.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  /** Cursor-paginated lead list, scoped by tenant + role. */
  @Get()
  @RequirePermissions('lead.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(LeadListQuerySchema)) query: LeadListQuery,
  ) {
    return this.service.list(user, query);
  }

  /**
   * Count and worth of the caller's leads per stage — the pipeline header and
   * stage rail. Declared before `:id` so the literal path wins the match.
   */
  @Get('stage-summary')
  @RequirePermissions('lead.read')
  stageSummary(@CurrentUser() user: RequestUser) {
    return this.service.stageSummary(user);
  }

  /** One lead. 404 for a lead outside the caller's scope. */
  @Get(':id')
  @RequirePermissions('lead.read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.get(user, id);
  }

  /** Create a lead (with optional line items). */
  @Post()
  @RequirePermissions('lead.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(LeadCreateSchema)) body: LeadCreate,
  ) {
    return this.service.create(user, body);
  }

  /** Partial scalar edit on one lead. */
  @Patch(':id')
  @RequirePermissions('lead.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LeadUpdateSchema)) body: LeadUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  /** Soft-delete one lead. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('lead.write')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
