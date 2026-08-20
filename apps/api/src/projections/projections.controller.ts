import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ProjectionListQuerySchema,
  ProjectionUpdateSchema,
  type ProjectionListQuery,
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
  @Patch(':id')
  @RequirePermissions('projection.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProjectionUpdateSchema)) body: ProjectionUpdate,
  ) {
    return this.service.update(user, id, body);
  }
}
