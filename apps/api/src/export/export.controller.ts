import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RequestUser } from '@greatsales/shared';
import { ExportService } from './export.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';

/**
 * The Data & Governance page's "Export" button.
 *
 * Requires ALL FOUR read permissions rather than one, because the file
 * carries all four entities — a custom role holding only `customer.read`
 * must not be able to pull leads/orders/payments through this door instead
 * of the ones that actually gate them. Every system role that can reach the
 * Data page (admin) already holds all four; a sales-role caller who reaches
 * this URL directly (the page itself is admin/super_admin-only in
 * apps/web/src/data/features.ts) gets back only their own scoped rows, the
 * same as `GET /customers` et al. — see ExportService.
 */
@ApiTags('export')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly service: ExportService) {}

  @Get('tenant.csv')
  @RequirePermissions(
    'customer.read',
    'lead.read',
    'order.read',
    'payment.read',
  )
  async tenantCsv(
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, body } = await this.service.tenantCsv(user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(body);
  }
}
