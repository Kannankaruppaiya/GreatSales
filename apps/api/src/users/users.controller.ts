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
  UserUpdateSchema,
  type UserCreate,
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

  /** Soft-delete one user. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('user.manage')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
