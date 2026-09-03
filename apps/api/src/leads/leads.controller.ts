import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AddLeadActivitySchema,
  CreateLeadSchema,
  CursorPageQuerySchema,
  UpdateLeadSchema,
  type AddLeadActivityInput,
  type CreateLeadInput,
  type CursorPageQuery,
  type RequestUser,
  type UpdateLeadInput,
} from '@greatsales/shared';
import { CurrentUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions } from '../auth/permissions.guard';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermissions('lead.read')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(CursorPageQuerySchema)) query: CursorPageQuery,
  ) {
    return this.leads.list(user, query);
  }

  @Get(':id')
  @RequirePermissions('lead.read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.leads.get(user, id);
  }

  @Post()
  @RequirePermissions('lead.write')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateLeadSchema)) body: CreateLeadInput,
  ) {
    return this.leads.create(user, body);
  }

  @Patch(':id')
  @RequirePermissions('lead.write')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLeadSchema)) body: UpdateLeadInput,
  ) {
    return this.leads.update(user, id, body);
  }

  @Post(':id/activities')
  @RequirePermissions('lead.write')
  addActivity(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddLeadActivitySchema))
    body: AddLeadActivityInput,
  ) {
    return this.leads.addActivity(user, id, body);
  }
}
