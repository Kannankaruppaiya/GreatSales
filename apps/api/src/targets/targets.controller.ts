import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  TargetListQuerySchema,
  TargetUpsertSchema,
  type RequestUser,
  type TargetListQuery,
  type TargetUpsert,
} from '@greatsales/shared';
import { TargetsService } from './targets.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Monthly sales targets.
 *
 * Reading needs `projection.read`, the same key the dashboard reads under — a
 * target is only ever looked at next to what was achieved. Setting one needs
 * `target.manage`, held by admin and management: a salesperson must not be able
 * to lower the number they are measured against.
 *
 * It used to read under `report.view`, which this comment already claimed was
 * the dashboard's key and is not: `report.view` is held by admin and management
 * only and guards this one route in the whole API. A salesperson was therefore
 * 403'd here while the dashboard — under `projection.read` — showed them their
 * own target figure anyway, and the sales branch of the service's
 * `resolveOwnerScope` could never be reached through HTTP at all. Refusing the
 * list while publishing the number is an inconsistency, not a protection; the
 * service scopes a sales caller to their own row either way.
 *
 * PUT rather than POST because `(salespersonId, period)` is unique, so "set
 * August for Megala" names one row whether or not it exists yet, and a caller
 * should not have to find out which before it can say so.
 */
@ApiTags('targets')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('targets')
export class TargetsController {
  constructor(private readonly service: TargetsService) {}

  @Get()
  @RequirePermissions('projection.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(TargetListQuerySchema)) query: TargetListQuery,
  ) {
    return this.service.list(user, query);
  }

  @Put()
  @RequirePermissions('target.manage')
  upsert(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(TargetUpsertSchema)) body: TargetUpsert,
  ) {
    return this.service.upsert(user, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('target.manage')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
