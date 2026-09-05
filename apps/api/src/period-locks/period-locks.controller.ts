import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  PeriodLockCreateSchema,
  PeriodLockListQuerySchema,
  type PeriodLockCreate,
  type PeriodLockListQuery,
  type RequestUser,
} from '@greatsales/shared';
import { PeriodLocksService } from './period-locks.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Reporting-period locks. Reading is open to anyone who can read projections —
 * the worksheet has to render its rows as read-only — while locking and
 * unlocking need `period.manage`, which admin and management hold and sales
 * does not.
 */
@ApiTags('period-locks')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('period-locks')
export class PeriodLocksController {
  constructor(private readonly service: PeriodLocksService) {}

  @Get()
  @RequirePermissions('projection.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(PeriodLockListQuerySchema))
    query: PeriodLockListQuery,
  ) {
    return this.service.list(user, query);
  }

  @Post()
  @RequirePermissions('period.manage')
  lock(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(PeriodLockCreateSchema)) body: PeriodLockCreate,
  ) {
    return this.service.lock(user, body);
  }

  @Delete(':period')
  @HttpCode(204)
  @RequirePermissions('period.manage')
  unlock(@CurrentUser() user: RequestUser, @Param('period') period: string) {
    return this.service.unlock(user, period);
  }
}
