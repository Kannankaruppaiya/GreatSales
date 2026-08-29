import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '@greatsales/shared';
import { IndustriesService } from './industries.service';
import { CurrentUser, RequireAnyPermission } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';

@ApiTags('industries')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('industries')
export class IndustriesController {
  constructor(private readonly service: IndustriesService) {}

  /**
   * The global industry catalogue that backs the customer and lead industry
   * pickers. Any role that can read or write either entity needs it, so ANY of
   * those four grants is enough — a viewer with only customer.read still gets a
   * populated dropdown, while nothing here writes.
   */
  @Get()
  @RequireAnyPermission(
    'customer.read',
    'customer.write',
    'lead.read',
    'lead.write',
  )
  list(@CurrentUser() user: RequestUser) {
    return this.service.list(user.tenantId);
  }
}
