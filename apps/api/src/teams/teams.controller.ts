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
  TeamCreateSchema,
  TeamMembersSchema,
  TeamUpdateSchema,
  type RequestUser,
  type TeamCreate,
  type TeamMembers,
  type TeamUpdate,
} from '@greatsales/shared';
import { TeamsService } from './teams.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Teams are part of user administration, so they sit behind `user.manage`
 * rather than a permission of their own — an administrator who can move people
 * between teams already has every capability a team grant would confer.
 */
@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  @Get()
  @RequirePermissions('user.manage')
  list(@CurrentUser() user: RequestUser) {
    return this.service.list(user);
  }

  @Post()
  @RequirePermissions('user.manage')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(TeamCreateSchema)) body: TeamCreate,
  ) {
    return this.service.create(user, body);
  }

  /** Declared before `:id` routes so a literal segment always wins. */
  @Get(':id/members')
  @RequirePermissions('user.manage')
  members(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.members(user, id);
  }

  @Post(':id/members')
  @HttpCode(200)
  @RequirePermissions('user.manage')
  addMembers(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TeamMembersSchema)) body: TeamMembers,
  ) {
    return this.service.addMembers(user, id, body);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @RequirePermissions('user.manage')
  removeMember(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.service.removeMember(user, id, userId);
  }

  @Patch(':id')
  @RequirePermissions('user.manage')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TeamUpdateSchema)) body: TeamUpdate,
  ) {
    return this.service.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('user.manage')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
