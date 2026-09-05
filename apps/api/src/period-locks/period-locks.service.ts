import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PeriodLockCreate,
  PeriodLockListQuery,
  PeriodLockRow,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';

const LOCK_INCLUDE = { lockedBy: true } satisfies Prisma.PeriodLockInclude;

type LockWithGraph = Prisma.PeriodLockGetPayload<{
  include: typeof LOCK_INCLUDE;
}>;

function toRow(l: LockWithGraph): PeriodLockRow {
  return {
    period: l.period,
    reason: l.reason,
    lockedById: l.lockedById,
    lockedByName: l.lockedBy.name,
    lockedAt: l.lockedAt.toISOString(),
  };
}

/**
 * Reporting-period locks.
 *
 * The row's existence IS the lock, so there is no boolean to fall out of sync
 * with itself and unlocking is a delete. Every list is small (one row per closed
 * month) so this resource is not paginated.
 */
@Injectable()
export class PeriodLocksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    query: PeriodLockListQuery,
  ): Promise<PeriodLockRow[]> {
    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.periodLock.findMany({
      where: query.period ? { period: query.period } : {},
      include: LOCK_INCLUDE,
      orderBy: { period: 'desc' },
    });
    return rows.map(toRow);
  }

  async lock(
    user: RequestUser,
    body: PeriodLockCreate,
  ): Promise<PeriodLockRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.periodLock.findFirst({
      where: { period: body.period },
      include: LOCK_INCLUDE,
    });
    if (existing) {
      // Locking a locked period is not an error worth failing a UI over, but it
      // must not silently reassign who locked it or when.
      throw new ConflictException(
        `${body.period} was already locked by ${existing.lockedBy.name}`,
      );
    }

    const created = await db.periodLock.create({
      data: {
        tenantId: user.tenantId,
        period: body.period,
        reason: body.reason ?? null,
        lockedById: user.userId,
      },
      include: LOCK_INCLUDE,
    });
    return toRow(created);
  }

  async unlock(user: RequestUser, period: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.periodLock.findFirst({ where: { period } });
    if (!existing) throw new NotFoundException(`${period} is not locked`);
    await db.periodLock.delete({ where: { id: existing.id } });
  }

  /**
   * Whether a period is frozen. Called by ProjectionsService on every write —
   * the check belongs on the server because the Data page's toggle it replaced
   * was local React state that reset on reload.
   */
  static async isLocked(db: TenantPrisma, period: string): Promise<boolean> {
    const lock = await db.periodLock.findFirst({
      where: { period },
      select: { id: true },
    });
    return lock !== null;
  }
}
