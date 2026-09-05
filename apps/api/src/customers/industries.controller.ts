import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { IndustryRow, RequestUser } from '@greatsales/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The industry catalogue.
 *
 * `Industry` is a GLOBAL table — no tenantId, readable by every tenant and
 * writable by none (20260825160000 revokes the write). So this is read-only by
 * construction, and there is no tenant scoping to get wrong.
 *
 * It exists because the customers list can now filter by `industryId` on the
 * server. Before that the filter ran over already-loaded rows, so its dropdown
 * could be built from those rows; a server filter cannot do that — narrowing to
 * one industry would leave that industry as the only option in the picker that
 * chose it. Both web and mobile also hardcoded their own industry lists, which
 * is the same catalogue kept in three places and true in at most one.
 */
@ApiTags('industries')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('industries')
export class IndustriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('customer.read')
  async list(@CurrentUser() user: RequestUser): Promise<IndustryRow[]> {
    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.industry.findMany({ orderBy: { name: 'asc' } });
    return rows.map((i) => ({
      id: i.id,
      name: i.name,
      subIndustries: Array.isArray(i.subIndustries)
        ? (i.subIndustries as string[])
        : [],
    }));
  }
}
