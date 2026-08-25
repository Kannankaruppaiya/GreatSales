import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  RoleCreateSchema,
  RoleUpdateSchema,
  type RequestUser,
  type RoleCreate,
  type RoleUpdate,
} from '@greatsales/shared';
import { RolesService } from './roles.service';
import {
  CurrentUser,
  RequireAnyPermission,
  RequirePermissions,
} from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class RolesController {
  constructor(private readonly service: RolesService) {}

  /**
   * List roles with their real grants and user counts.
   *
   * Readable with `user.manage` OR `role.manage`. The user editor needs this
   * to populate its role dropdown, so requiring `role.manage` would lock an
   * administrator out of their own user form — while every WRITE below still
   * demands `role.manage`.
   */
  @Get('roles')
  @RequireAnyPermission('user.manage', 'role.manage')
  list(@CurrentUser() user: RequestUser) {
    return this.service.list(user);
  }

  /**
   * The permission catalogue for rendering a matrix.
   *
   * Static and tenant-agnostic — permissions are a property of the software —
   * so it needs only authentication.
   */
  @Get('permissions')
  permissions() {
    return this.service.permissions();
  }

  @Post('roles')
  @RequirePermissions('role.manage')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(RoleCreateSchema)) body: RoleCreate,
  ) {
    return this.service.create(user, body);
  }

  @Patch('roles/:id')
  @RequirePermissions('role.manage')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RoleUpdateSchema)) body: RoleUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  @RequirePermissions('role.manage')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
