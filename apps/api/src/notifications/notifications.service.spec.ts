import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { LeadsService } from '../leads/leads.service';

/**
 * The bell.
 *
 * Two properties carry the whole feature, and both are the kind that look
 * obviously true in the code and quietly stop being true later.
 *
 * A notification is never delivered to the person who caused it. A bell that
 * reports your own actions back at you is one people stop reading, and once
 * they stop reading it the assignments they DID need to see are lost with the
 * rest. That is asserted directly rather than trusted to a one-line guard.
 *
 * And a failure to notify never fails the business action. The lead is already
 * reassigned by the time notify() runs; rolling that back because the bell
 * could not be written would be a cosmetic concern breaking real work.
 */
const ACME = 'tenant_acme';

const admin: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: ACME,
  roleId: 'role_admin_acme',
};
const SALES_1 = 'user_sales1_acme';
const SALES_2 = 'user_sales2_acme';
const asSales1: RequestUser = {
  userId: SALES_1,
  tenantId: ACME,
  roleId: 'role_sales_acme',
};

describe('NotificationsService (integration)', () => {
  let prisma: PrismaService;
  let notifications: NotificationsService;
  let leads: LeadsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    notifications = new NotificationsService(prisma);
    leads = new LeadsService(prisma, notifications);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    // The table starts empty in the fixtures and every test writes its own.
    await prisma
      .forTenant(ACME)
      .notification.deleteMany({ where: { tenantId: ACME } });
  });

  it('starts empty and counts nothing', async () => {
    expect(await notifications.list(asSales1, { limit: 30, unreadOnly: false })).toEqual({
      items: [],
      unread: 0,
    });
  });

  it('tells the new owner when a lead is assigned to them', async () => {
    const lead = await leads.create(admin, {
      customerName: 'Bell Test Industries',
      salespersonId: SALES_1,
    });

    const inbox = await notifications.list(asSales1, { limit: 30, unreadOnly: false });
    expect(inbox.unread).toBe(1);
    expect(inbox.items[0]).toMatchObject({
      type: 'LeadAssigned',
      read: false,
      // Clickable: an alert with nowhere to go makes the reader find the row
      // by hand, which is most of the work it was meant to save.
      entityType: 'Lead',
      entityId: lead.id,
    });
    expect(inbox.items[0].title).toContain('Bell Test Industries');
  });

  it('does not tell you about your own action', async () => {
    // A salesperson creating their own lead owns it the moment it exists.
    await leads.create(asSales1, {
      customerName: 'Self Serve Ltd',
      salespersonId: SALES_1,
    });
    expect((await notifications.list(asSales1, { limit: 30, unreadOnly: false })).unread).toBe(0);
  });

  it('notifies on reassignment, and only the person receiving it', async () => {
    const lead = await leads.create(admin, {
      customerName: 'Handover Corp',
      salespersonId: SALES_1,
    });
    await notifications.markAllRead(asSales1);

    await leads.update(admin, lead.id, { salespersonId: SALES_2 });

    const receiving = await notifications.list(
      { ...asSales1, userId: SALES_2 },
      { limit: 30, unreadOnly: false },
    );
    expect(receiving.unread).toBe(1);
    expect(receiving.items[0].type).toBe('LeadAssigned');

    // The person who lost it is not told twice about a lead they no longer
    // have; the one row they got was the original assignment, already read.
    expect((await notifications.list(asSales1, { limit: 30, unreadOnly: false })).unread).toBe(0);
  });

  it('does not repeat itself when a patch names the same owner', async () => {
    const lead = await leads.create(admin, {
      customerName: 'No Change Ltd',
      salespersonId: SALES_1,
    });
    await notifications.markAllRead(asSales1);

    await leads.update(admin, lead.id, { salespersonId: SALES_1 });
    expect((await notifications.list(asSales1, { limit: 30, unreadOnly: false })).unread).toBe(0);
  });

  it('marks one read, and marks the rest read in a single call', async () => {
    for (const name of ['One Ltd', 'Two Ltd', 'Three Ltd']) {
      await leads.create(admin, { customerName: name, salespersonId: SALES_1 });
    }
    const inbox = await notifications.list(asSales1, { limit: 30, unreadOnly: false });
    expect(inbox.unread).toBe(3);

    await notifications.markRead(asSales1, inbox.items[0].id);
    expect((await notifications.list(asSales1, { limit: 30, unreadOnly: false })).unread).toBe(2);

    expect(await notifications.markAllRead(asSales1)).toEqual({ read: 2 });
    expect((await notifications.list(asSales1, { limit: 30, unreadOnly: false })).unread).toBe(0);
  });

  it('refuses to mark somebody else’s notification read', async () => {
    await leads.create(admin, {
      customerName: 'Not Yours Ltd',
      salespersonId: SALES_1,
    });
    const inbox = await notifications.list(asSales1, { limit: 30, unreadOnly: false });

    // Not "forbidden" — the row does not exist as far as this caller is
    // concerned, and saying otherwise would confirm it exists.
    await expect(
      notifications.markRead(
        { ...asSales1, userId: SALES_2 },
        inbox.items[0].id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters to unread while still counting the whole inbox', async () => {
    await leads.create(admin, { customerName: 'A Ltd', salespersonId: SALES_1 });
    await leads.create(admin, { customerName: 'B Ltd', salespersonId: SALES_1 });
    const inbox = await notifications.list(asSales1, { limit: 30, unreadOnly: false });
    await notifications.markRead(asSales1, inbox.items[0].id);

    const unread = await notifications.list(asSales1, {
      limit: 30,
      unreadOnly: true,
    });
    expect(unread.items).toHaveLength(1);
    expect(unread.unread).toBe(1);
  });

  it('does not fail the business action when it cannot notify', async () => {
    // A user id that does not exist violates the foreign key, which is the
    // realistic shape of "the notification could not be written".
    await expect(
      notifications.notify({
        tenantId: ACME,
        userId: 'user_who_is_not_there',
        actorId: admin.userId,
        type: 'System',
        title: 'This cannot be stored',
      }),
    ).resolves.toBeUndefined();
  });
});
