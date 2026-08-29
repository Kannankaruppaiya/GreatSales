import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from './customers.service';

/**
 * Integration test against the real Dockerized Postgres via the RLS-bound app
 * role. Reseeds once for determinism, then exercises the service end-to-end:
 * enrichment, RLS tenant isolation, role scoping, and CRUD + soft-delete.
 */
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

describe('CustomersService (integration)', () => {
  let prisma: PrismaService;
  let service: CustomersService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new CustomersService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns the seeded Acme customer enriched with names', async () => {
    const res = await service.list(admin('tenant_acme', 'acme'), { limit: 20 });

    expect(res.items).toHaveLength(1);
    const c = res.items[0];
    expect(c.name).toBe('Acme Corp Customer One');
    expect(c.category).toBe('Gold');
    expect(c.area).toBe('North');
    expect(c.outstanding).toBe(40000);
    expect(c.salespersonName).toBe('Acme Corp Sales One');
    expect(c.collectorName).toBe('Acme Corp Sales One');
    expect(c.industryName).toBe('Pharmaceutical');
    expect(c.primaryContactName).toBe('Primary Contact');
    expect(res.nextCursor).toBeNull();
  });

  it('isolates tenants — Globex admin never sees Acme customers (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      limit: 20,
    });
    expect(res.items.every((c) => !c.name.includes('Acme'))).toBe(true);
    expect(res.items[0]?.name).toBe('Globex Inc Customer One');
  });

  it('scopes a salesperson to their own customers only', async () => {
    const owner = await service.list(sales('tenant_acme', 'acme', 1), {
      limit: 20,
    });
    expect(owner.items).toHaveLength(1);

    const other = await service.list(sales('tenant_acme', 'acme', 2), {
      limit: 20,
    });
    expect(other.items).toHaveLength(0);
  });

  it('creates a customer and returns it enriched', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Acme New Buyer',
      salespersonId: 'user_sales2_acme',
      category: 'Silver',
      outstanding: 1500,
    });
    expect(created.name).toBe('Acme New Buyer');
    expect(created.category).toBe('Silver');
    expect(created.outstanding).toBe(1500);
    expect(created.salespersonName).toBe('Acme Corp Sales Two');

    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    expect(list.items.some((c) => c.name === 'Acme New Buyer')).toBe(true);
  });

  it('forces a salesperson to own the customers they create', async () => {
    const created = await service.create(sales('tenant_acme', 'acme', 1), {
      name: 'Sales1 Self Customer',
      salespersonId: 'user_sales2_acme', // attempt to assign to someone else
    });
    // sales-only callers cannot hand a customer to another rep
    expect(created.salespersonId).toBe('user_sales1_acme');
  });

  it('updates a customer and returns the new values', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((c) => c.name === 'Acme Corp Customer One')!.id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      category: 'Platinum',
      outstanding: 0,
    });
    expect(updated.category).toBe('Platinum');
    expect(updated.outstanding).toBe(0);
  });

  it('forbids a salesperson from editing another salesperson customer', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((c) => c.name === 'Acme Corp Customer One')!.id;

    await expect(
      service.update(sales('tenant_acme', 'acme', 2), id, { area: 'West' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft-deletes a customer so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Doomed Customer',
      salespersonId: 'user_sales1_acme',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);

    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    expect(list.items.some((c) => c.id === created.id)).toBe(false);

    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, { area: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('contacts (sub-resource)', () => {
    const acme = () => admin('tenant_acme', 'acme');
    let customerId: string;

    beforeAll(async () => {
      const c = await service.create(acme(), {
        name: 'Contact Test Co',
        salespersonId: 'user_sales1_acme',
      });
      customerId = c.id;
    });

    it('makes the first contact primary automatically', async () => {
      const c = await service.createContact(acme(), customerId, {
        name: 'Alice',
        mobile: '900',
      });
      expect(c.isPrimary).toBe(true);
      const { items } = await service.listContacts(acme(), customerId);
      expect(items).toHaveLength(1);
    });

    it('leaves a second contact non-primary unless asked', async () => {
      const c = await service.createContact(acme(), customerId, {
        name: 'Bob',
      });
      expect(c.isPrimary).toBe(false);
    });

    it('promoting a contact demotes the previous primary (at most one)', async () => {
      const items = (await service.listContacts(acme(), customerId)).items;
      const bob = items.find((x) => x.name === 'Bob')!;
      await service.updateContact(acme(), customerId, bob.id, {
        isPrimary: true,
      });
      const after = (await service.listContacts(acme(), customerId)).items;
      expect(after.filter((x) => x.isPrimary)).toHaveLength(1);
      expect(after.find((x) => x.isPrimary)!.name).toBe('Bob');
    });

    it('reflects the promoted primary on the customer list row', async () => {
      const list = await service.list(acme(), { limit: 100 });
      const row = list.items.find((c) => c.id === customerId)!;
      expect(row.primaryContactName).toBe('Bob');
    });

    it('ignores isPrimary:false — a contactful customer keeps one primary', async () => {
      const bob = (await service.listContacts(acme(), customerId)).items.find(
        (x) => x.name === 'Bob',
      )!;
      const updated = await service.updateContact(acme(), customerId, bob.id, {
        isPrimary: false,
      });
      expect(updated.isPrimary).toBe(true);
    });

    it('promotes the next oldest when the primary is deleted', async () => {
      const bob = (await service.listContacts(acme(), customerId)).items.find(
        (x) => x.name === 'Bob',
      )!;
      await service.removeContact(acme(), customerId, bob.id);
      const after = (await service.listContacts(acme(), customerId)).items;
      expect(after.some((x) => x.name === 'Bob')).toBe(false);
      expect(after.filter((x) => x.isPrimary)).toHaveLength(1);
      expect(after.find((x) => x.isPrimary)!.name).toBe('Alice');
    });

    it('edits a contact field', async () => {
      const alice = (await service.listContacts(acme(), customerId)).items.find(
        (x) => x.name === 'Alice',
      )!;
      const updated = await service.updateContact(
        acme(),
        customerId,
        alice.id,
        {
          designation: 'Owner',
          email: 'a@x.test',
        },
      );
      expect(updated.designation).toBe('Owner');
      expect(updated.email).toBe('a@x.test');
    });

    it('404s contacts on a customer the caller cannot see (cross-tenant RLS)', async () => {
      await expect(
        service.listContacts(admin('tenant_globex', 'globex'), customerId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids a sales user from touching another owner’s customer contacts', async () => {
      await expect(
        service.createContact(sales('tenant_acme', 'acme', 2), customerId, {
          name: 'X',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404s an unknown contact id', async () => {
      await expect(
        service.updateContact(acme(), customerId, 'no_such_contact', {
          name: 'Y',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
