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
  ProjectionListQuerySchema,
  ProjectionRollForwardSchema,
  ProjectionUpdateSchema,
  type ProjectionListQuery,
  type ProjectionRollForward,
  type ProjectionUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { ProjectionsService } from './projections.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('projections')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('projections')
export class ProjectionsController {
  constructor(private readonly service: ProjectionsService) {}

  /** Recurring-sales worksheet for a period, scoped by tenant + role. */
  @Get()
  @RequirePermissions('projection.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(ProjectionListQuerySchema))
    query: ProjectionListQuery,
  ) {
    return this.service.list(user, query);
  }

  /** Inline cell edit on one projection line. */
  /**
   * Open a month by carrying the previous month's commitments into it.
   *
   * `projection.write`, the same key an inline cell edit needs: this writes
   * projection rows and nothing else, and a role that may type a number into
   * the worksheet may also start the month it goes in.
   */
  @Post('roll-forward')
  @RequirePermissions('projection.write')
  rollForward(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(ProjectionRollForwardSchema))
    body: ProjectionRollForward,
  ) {
    return this.service.rollForward(user, body);
  }

  /** One worksheet line. 404 outside the caller's scope. */
  @Get(':id')
  @RequirePermissions('projection.read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.get(user, id);
  }

  @Patch(':id')
  @RequirePermissions('projection.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProjectionUpdateSchema)) body: ProjectionUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  /** Drop a line from a month. Soft: the row leaves the worksheet, not the record. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('projection.write')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
