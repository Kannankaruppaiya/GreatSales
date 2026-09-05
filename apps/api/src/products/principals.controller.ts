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
  PrincipalCreateSchema,
  PrincipalUpdateSchema,
  type PrincipalCreate,
  type PrincipalUpdate,
  type RequestUser,
} from '@greatsales/shared';
import { ProductsService } from './products.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('principals')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('principals')
export class PrincipalsController {
  constructor(private readonly service: ProductsService) {}

  /** List all active principals for the tenant. */
  @Get()
  @RequirePermissions('order.read')
  list(@CurrentUser() user: RequestUser) {
    return this.service.listPrincipals(user);
  }

  /** Create a new principal brand. */
  @Post()
  @RequirePermissions('user.manage')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(PrincipalCreateSchema)) body: PrincipalCreate,
  ) {
    return this.service.createPrincipal(user, body);
  }

  /** Edit a principal. */
  @Patch(':id')
  @RequirePermissions('user.manage')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PrincipalUpdateSchema)) body: PrincipalUpdate,
  ) {
    return this.service.updatePrincipal(user, id, body);
  }

  /** Soft-delete a principal. */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('user.manage')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.removePrincipal(user, id);
  }
}
