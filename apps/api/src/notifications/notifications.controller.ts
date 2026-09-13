import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  NotificationListQuerySchema,
  type NotificationListQuery,
  type RequestUser,
} from '@greatsales/shared';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * The signed-in user's own notifications.
 *
 * Deliberately NOT decorated with @RequirePermissions. There is no permission
 * that could apply: every route here is scoped to `user.userId` in the service,
 * so the only thing a caller can reach is their own inbox. Requiring a key
 * would mean a role could exist that is allowed to sign in but not to see what
 * happened to it, which is not a state this product wants.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(NotificationListQuerySchema))
    query: NotificationListQuery,
  ) {
    return this.service.list(user, query);
  }

  /**
   * Declared BEFORE `:id/read` — Nest matches in declaration order, and a
   * `:id` route placed first would read "read-all" as an id.
   */
  @Post('read-all')
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.service.markAllRead(user);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.markRead(user, id);
  }
}
