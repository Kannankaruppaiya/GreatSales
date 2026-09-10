import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { EntityType, NotificationType } from '@prisma/client';
import type {
  NotificationListQuery,
  NotificationListResponse,
  NotificationRow,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';

/** What one emitter has to say. `actorId` is who caused it, not who hears it. */
export interface NotifyInput {
  tenantId: string;
  /** Who should hear about this. */
  userId: string;
  /** Who did it. A notification is never delivered back to this person. */
  actorId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: EntityType;
  entityId?: string;
}

/**
 * The bell's inbox.
 *
 * Read scope is the user, not the tenant: `userId` is the addressee and there
 * is no "everyone's notifications" view. Tenant isolation still applies
 * underneath through RLS, so a notification cannot cross a workspace even if a
 * user id somehow collided.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    query: NotificationListQuery,
  ): Promise<NotificationListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const [rows, unread] = await Promise.all([
      db.notification.findMany({
        where: {
          userId: user.userId,
          ...(query.unreadOnly ? { read: false } : {}),
        },
        orderBy: { at: 'desc' },
        take: query.limit,
      }),
      // Counted over the whole inbox rather than the page above: a badge that
      // counts only what was fetched reads "30" forever and stops meaning
      // anything on a busy workspace.
      db.notification.count({ where: { userId: user.userId, read: false } }),
    ]);
    return { items: rows.map(toRow), unread };
  }

  async markRead(user: RequestUser, id: string): Promise<NotificationRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.notification.findFirst({
      where: { id, userId: user.userId },
    });
    // Scoped to the caller: marking somebody else's notification read would
    // silently empty their bell.
    if (!existing) throw new NotFoundException('No such notification.');
    const updated = await db.notification.update({
      where: { id },
      data: { read: true },
    });
    return toRow(updated);
  }

  /** Clear the badge. Returns how many were actually unread. */
  async markAllRead(user: RequestUser): Promise<{ read: number }> {
    const db = this.prisma.forTenant(user.tenantId);
    const { count } = await db.notification.updateMany({
      where: { userId: user.userId, read: false },
      data: { read: true },
    });
    return { read: count };
  }

  /**
   * Record something that happened, for somebody else.
   *
   * Two things this deliberately does NOT do.
   *
   * It does not notify the actor. A salesperson who moves their own order to
   * Delivered does not need to be told; a bell that reports your own actions
   * back to you is one people learn to ignore, and an ignored bell fails at the
   * one job it has.
   *
   * It does not throw. A notification is a side effect of a business action
   * that has already succeeded — the lead IS reassigned by the time this runs.
   * Failing the request because the bell could not be updated would roll back
   * real work for a cosmetic reason, so a failure is logged and swallowed. The
   * caller passes its own transaction client when it has one, which is how the
   * notification lands or does not land with the write it describes.
   */
  async notify(input: NotifyInput, tx?: TenantPrisma): Promise<void> {
    if (input.userId === input.actorId) return;
    const db = tx ?? this.prisma.forTenant(input.tenantId);
    try {
      await db.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Could not record a ${input.type} notification for ${input.userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

function toRow(n: {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  at: Date;
  entityType: EntityType | null;
  entityId: string | null;
}): NotificationRow {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    at: n.at.toISOString(),
    entityType: n.entityType as NotificationRow['entityType'],
    entityId: n.entityId,
  };
}
