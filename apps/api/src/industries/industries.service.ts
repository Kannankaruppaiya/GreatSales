import { Injectable } from '@nestjs/common';
import type { IndustryListResponse } from '@greatsales/shared';
import { SubIndustriesSchema } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Reads the global industry catalogue. `Industry` has no tenant column and is
 * SELECT-only for the runtime role (lock_global_reference_tables migration), so
 * this is read-only and the same rows are visible to every tenant — the query
 * runs under any tenant scope without changing the result.
 */
@Injectable()
export class IndustriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<IndustryListResponse> {
    const rows = await this.prisma.forTenant(tenantId).industry.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      // The column is Json (defaults to []). Parse defensively rather than
      // trusting the shape, and drop anything that is not a string list.
      subIndustries: SubIndustriesSchema.catch([]).parse(r.subIndustries),
    }));
  }
}
