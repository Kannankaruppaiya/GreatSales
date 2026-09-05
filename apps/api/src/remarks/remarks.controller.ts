import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  RemarkCreateSchema,
  RemarkListQuerySchema,
  type RemarkCreate,
  type RemarkListQuery,
  type RequestUser,
} from '@greatsales/shared';
import { RemarksService } from './remarks.service';
import { CurrentUser } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Free-text notes on any of the five annotatable entities.
 *
 * Deliberately NOT decorated with @RequirePermissions: the key a call needs
 * depends on the `entityType` it carries (a note on a Payment needs
 * `payment.read`, one on a Lead needs `lead.read`), which the guard cannot see.
 * RemarksService.assertPermission does that check per request — see the comment
 * there before adding a decorator here and assuming it is covered.
 *
 * Remarks are append-only: there is no PATCH or DELETE. An activity trail that
 * can be rewritten is not a trail, and nothing in the product asks to edit one.
 */
@ApiTags('remarks')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('remarks')
export class RemarksController {
  constructor(private readonly service: RemarksService) {}

  /** One entity's note timeline, newest first. */
  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(RemarkListQuerySchema)) query: RemarkListQuery,
  ) {
    return this.service.list(user, query);
  }

  /** Post a note. The author is always the caller. */
  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(RemarkCreateSchema)) body: RemarkCreate,
  ) {
    return this.service.create(user, body);
  }
}
