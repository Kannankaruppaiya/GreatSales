import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { IndustryDto } from '@greatsales/shared';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Industries — global master data (no tenant scope) used by customer forms.
 * Read requires `customer.read` since it's only surfaced while managing
 * customers. A separate route from /customers/:id so it isn't shadowed by the
 * id param.
 */
@ApiTags('industries')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('industries')
export class IndustriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('customer.read')
  async list(): Promise<IndustryDto[]> {
    const rows = await this.prisma.industry.findMany({ orderBy: { name: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      subIndustries: Array.isArray(r.subIndustries) ? (r.subIndustries as string[]) : [],
    }));
  }
}
