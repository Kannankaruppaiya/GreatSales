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
  UserCreateSchema,
  UserListQuerySchema,
  UserResetPasswordSchema,
  UserUpdateSchema,
  type UserCreate,
  type UserResetPassword,
  type UserListQuery,
  type UserUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { UsersService } from './users.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  /** Cursor-paginated tenant-user list (admin-side). */
  @Get()
  @RequirePermissions('user.manage')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(UserListQuerySchema)) query: UserListQuery,
  ) {
    return this.service.list(user, query);
  }

  /**
   * The tenant roster — every authenticated member, not just `user.manage`
   * holders. Declared BEFORE `:id` below for the same reason `:id` is
   * declared after the bare list: Nest matches in declaration order, and a
   * `:id` route placed first would swallow `/users/directory` as a lookup for
   * a user literally named "directory".
   */
  @Get('directory')
  directory(@CurrentUser() user: RequestUser) {
    return this.service.directory(user);
  }

  /**
   * One user by id.
   *
   * Declared AFTER the bare @Get() above: Nest matches in declaration order,
   * so a `:id` route placed first would swallow `/users` itself.
   */
  @Get(':id')
  @RequirePermissions('user.manage')
  get(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.service.get(user, id, includeDeleted === 'true');
  }

  /** Create a tenant user. */
  @Post()
  @RequirePermissions('user.manage')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(UserCreateSchema)) body: UserCreate,
  ) {
    return this.service.create(user, body);
  }

  /** Partial edit on one user (password, if present, is re-hashed). */
  @Patch(':id')
  @RequirePermissions('user.manage')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UserUpdateSchema)) body: UserUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  /**
   * Un-delete a soft-deleted user. 409 if their email or username has been
   * taken by someone else in the meantime.
   */
  @Post(':id/restore')
  @RequirePermissions('user.manage')
  restore(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.restore(user, id);
  }

  /**
   * Admin-initiated password reset. Ends every session the target has and
   * requires them to choose a new password at their next sign-in.
   */
  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermissions('user.manage')
  resetPassword(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UserResetPasswordSchema))
    body: UserResetPassword,
  ) {
    return this.service.resetPassword(user, id, body);
  }

  /** Soft-delete one user. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('user.manage')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
