import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from './leads.service';
import { NotificationsService } from '../notifications/notifications.service';

const admin = (tid: string, roleKey: string): RequestUser => ({
  userId: `user_admin_${roleKey}`,
  tenantId: tid,
  roleId: `role_admin_${roleKey}`,
});
const sales = (tid: string, roleKey: string, n: 1 | 2): RequestUser => ({
  userId: `user_sales${n}_${roleKey}`,
  tenantId: tid,
  roleId: `role_sales_${roleKey}`,
});

describe('LeadsService (integration)', () => {
  let prisma: PrismaService;
  let service: LeadsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    // Real, not a stub: notify() writes a row and swallows its own failures,
    // so a service under test behaves exactly as it does in the app.
    const notifications = new NotificationsService(prisma);
    service = new LeadsService(prisma, notifications);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns the seeded Acme lead enriched with products and total value', async () => {
    const res = await service.list(admin('tenant_acme', 'acme'), { limit: 20 });

    // Found by name rather than assumed to be the only row: the fixtures carry
    // a second, already-won lead so the dashboard's window has something to
    // find, and a test that counts the seed breaks every time the seed grows.
    const l = res.items.find((x) => x.customerName === 'Acme Corp Prospect')!;
    expect(l).toBeDefined();
    expect(l.stage).toBe('NeedsAnalysis');
    expect(l.salespersonName).toBe('Acme Corp Sales One');
    expect(l.industryName).toBe('Automotive');
    expect(l.products).toHaveLength(1);
    expect(l.products[0].productName).toBe('New Product X');
    expect(l.totalValue).toBe(75000);
  });

  it('isolates tenants — Globex admin never sees Acme leads (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      limit: 20,
    });
    expect(res.items.every((l) => !l.customerName.includes('Acme'))).toBe(true);
    expect(res.items[0]?.customerName).toBe('Globex Inc Prospect');
  });

  it('scopes a salesperson to their own leads only', async () => {
    const owner = await service.list(sales('tenant_acme', 'acme', 1), {
      limit: 20,
    });
    // The assertion that matters is WHOSE, not how many: every row belongs to
    // the caller, and the other salesperson sees nothing at all.
    expect(owner.items.length).toBeGreaterThan(0);
    expect(
      owner.items.every((l) => l.salespersonId === 'user_sales1_acme'),
    ).toBe(true);

    const other = await service.list(sales('tenant_acme', 'acme', 2), {
      limit: 20,
    });
    expect(other.items).toHaveLength(0);
  });

  it('creates a lead with line items and sums their value', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      customerName: 'Acme Fresh Lead',
      salespersonId: 'user_sales1_acme',
      products: [
        { productName: 'Widget', value: 100 },
        { productName: 'Gadget', value: 200 },
      ],
    });
    expect(created.customerName).toBe('Acme Fresh Lead');
    expect(created.stage).toBe('NewEnquiries'); // DB default
    expect(created.products).toHaveLength(2);
    expect(created.totalValue).toBe(300);
  });

  it('stamps stageUpdatedAt when the stage changes', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find(
      (l) => l.customerName === 'Acme Corp Prospect',
    )!.id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      stage: 'ProposalsAndPriceQuote',
    });
    expect(updated.stage).toBe('ProposalsAndPriceQuote');
    expect(updated.stageUpdatedAt).not.toBeNull();
  });

  it('forbids a salesperson from editing another salesperson lead', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find(
      (l) => l.customerName === 'Acme Corp Prospect',
    )!.id;
    await expect(
      service.update(sales('tenant_acme', 'acme', 2), id, { area: 'West' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft-deletes a lead so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      customerName: 'Doomed Lead',
      salespersonId: 'user_sales1_acme',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    expect(list.items.some((l) => l.id === created.id)).toBe(false);
    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, { area: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('the line items a negotiation moves', () => {
    it('replaces the products on an update, and re-totals the deal', async () => {
      const created = await service.create(admin('tenant_acme', 'acme'), {
        customerName: 'Line Item Co',
        salespersonId: 'user_sales1_acme',
        products: [
          { productName: 'CUT 100', qty: 10, price: 100, value: 1000 },
          { productName: 'AW 68', qty: 5, price: 200, value: 1000 },
        ],
      });
      expect(created.totalValue).toBe(2000);

      // The customer halves the order and agrees a better price on what is
      // left. Before this was possible the only way to record it was to delete
      // the lead and type it again, losing its remarks and its history.
      const updated = await service.update(
        admin('tenant_acme', 'acme'),
        created.id,
        {
          products: [
            { productName: 'CUT 100', qty: 5, price: 120, value: 600 },
          ],
        },
      );
      expect(updated.products).toHaveLength(1);
      expect(updated.products[0].productName).toBe('CUT 100');
      expect(updated.totalValue).toBe(600);
    });

    it('leaves the line items alone when the patch does not mention them', async () => {
      const created = await service.create(admin('tenant_acme', 'acme'), {
        customerName: 'Untouched Lines Co',
        salespersonId: 'user_sales1_acme',
        products: [
          { productName: 'CUT 100', qty: 10, price: 100, value: 1000 },
        ],
      });
      // A stage move must never rewrite a deal's value as a side effect.
      const moved = await service.update(
        admin('tenant_acme', 'acme'),
        created.id,
        {
          stage: 'ProposalsAndPriceQuote',
        },
      );
      expect(moved.products).toHaveLength(1);
      expect(moved.totalValue).toBe(1000);
    });

    it('takes every scalar the detail form now offers', async () => {
      const created = await service.create(admin('tenant_acme', 'acme'), {
        customerName: 'Grade Me Co',
        salespersonId: 'user_sales1_acme',
      });
      expect(created.tier).toBeNull();

      const graded = await service.update(
        admin('tenant_acme', 'acme'),
        created.id,
        {
          tier: 'Platinum',
          type: 'New',
          division: 'LUB',
          address: 'Plot 12, Ambattur',
        },
      );
      expect(graded.tier).toBe('Platinum');
      expect(graded.type).toBe('New');
      expect(graded.division).toBe('LUB');
      expect(graded.address).toBe('Plot 12, Ambattur');
    });
  });

  describe('contacts', () => {
    it('stores every contact and names the primary on the row', async () => {
      const lead = await service.create(admin('tenant_acme', 'acme'), {
        customerName: 'Two Contacts Ltd',
        salespersonId: 'user_sales1_acme',
        contacts: [
          {
            name: 'Mr. P. Subramanian',
            designation: 'Plant Head',
            phone: '+91 98400 11111',
            sameAsMobile: true,
            isPrimary: true,
          },
          {
            name: 'Ms. R. Devi',
            designation: 'Purchase Manager',
            phone: '+91 98400 22222',
            email: 'purchase@two.test',
            sameAsMobile: false,
            whatsapp: '+91 90000 00000',
          },
        ],
      });

      expect(lead.contacts).toHaveLength(2);
      // Primary first — the order IS the contract, because every list cell
      // and the printed paperwork read [0].
      expect(lead.contacts[0].name).toBe('Mr. P. Subramanian');
      expect(lead.contacts[0].designation).toBe('Plant Head');
      // sameAsMobile mirrors the number rather than asking for it twice.
      expect(lead.contacts[0].whatsapp).toBe('+91 98400 11111');
      expect(lead.contacts[1].whatsapp).toBe('+91 90000 00000');
      // The denormalised pair the list, dashboard and mobile read.
      expect(lead.contactName).toBe('Mr. P. Subramanian');
      expect(lead.phone).toBe('+91 98400 11111');
    });

    it('replaces the list, so somebody who has left is gone', async () => {
      const lead = await service.create(admin('tenant_acme', 'acme'), {
        customerName: 'Staff Turnover Co',
        salespersonId: 'user_sales1_acme',
        contacts: [
          { name: 'Old Buyer', phone: '1', isPrimary: true },
          { name: 'Second Person', phone: '2' },
        ],
      });
      expect(lead.contacts).toHaveLength(2);

      const after = await service.update(
        admin('tenant_acme', 'acme'),
        lead.id,
        {
          contacts: [{ name: 'New Buyer', phone: '3', isPrimary: true }],
        },
      );
      expect(after.contacts).toHaveLength(1);
      expect(after.contacts[0].name).toBe('New Buyer');
      expect(after.contactName).toBe('New Buyer');
    });

    it('leaves the contacts alone when the patch does not mention them', async () => {
      const lead = await service.create(admin('tenant_acme', 'acme'), {
        customerName: 'Stage Move Co',
        salespersonId: 'user_sales1_acme',
        contacts: [{ name: 'Keep Me', phone: '9', isPrimary: true }],
      });

      const moved = await service.update(
        admin('tenant_acme', 'acme'),
        lead.id,
        {
          stage: 'NeedsAnalysis',
        },
      );
      expect(moved.stage).toBe('NeedsAnalysis');
      expect(moved.contacts.map((c) => c.name)).toEqual(['Keep Me']);
    });
  });

  /**
   * The same rule as payments and leads: owning a record proves who owns it
   * NOW, and `salespersonId` was writable on the patch that follows — so a rep
   * could push an account onto a colleague and out of their own book. Admin
   * still reassigns, which is what the bulk reassign flow runs as.
   */
  describe('a salesperson cannot give a lead away', () => {
    it('refuses a patch that names another salesperson', async () => {
      const own = await service.create(sales('tenant_acme', 'acme', 1), {
        customerName: 'Reassign Guard Lead',
        salespersonId: 'user_sales1_acme',
      });
      await expect(
        service.update(sales('tenant_acme', 'acme', 1), own.id, {
          salespersonId: 'user_sales2_acme',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an administrator reassign it', async () => {
      const own = await service.create(admin('tenant_acme', 'acme'), {
        customerName: 'Reassign Allowed Lead',
        salespersonId: 'user_sales1_acme',
      });
      const moved = await service.update(admin('tenant_acme', 'acme'), own.id, {
        salespersonId: 'user_sales2_acme',
      });
      expect(moved.salespersonId).toBe('user_sales2_acme');
    });
  });
});
