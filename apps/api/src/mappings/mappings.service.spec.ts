import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { randomUUID } from 'node:crypto';
import { reseedTestDatabase } from '../test-support/reseed';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MappingsService } from './mappings.service';

/**
 * F5 — customer x product mappings.
 *
 * Runs against real Postgres as the RLS-bound role. What matters here is scope
 * and constraints — who may see or change what, and which writes the database
 * refuses — and a mocked Prisma client would assert nothing about either.
 */
const TENANT = 'tenant_acme';
const admin: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: TENANT,
  roleId: 'role_admin_acme',
};
const sales1: RequestUser = {
  userId: 'user_sales1_acme',
  tenantId: TENANT,
  roleId: 'role_sales_acme',
};
const SALES2 = 'user_sales2_acme';

describe('MappingsService', () => {
  let prisma: PrismaService;
  let service: MappingsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new MappingsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  /**
   * Mints a fresh product and pairs it with the seeded customer.
   *
   * The acme fixture is one customer and two products, both already mapped, so
   * there is no spare pair to borrow — and freeing one by deleting a mapping is
   * impossible, since `Projection.mappingId` is a required FK. Creating the
   * product makes each test self-sufficient and independent of fixture slack.
   */
  async function freshPair(basePrice: number | null = null) {
    const db = prisma.forTenant(TENANT);
    const customer = await db.customer.findFirst({ select: { id: true } });
    const principal = await db.principal.findFirst({ select: { id: true } });
    if (!customer || !principal)
      throw new Error('acme fixture is missing rows');

    const product = await db.product.create({
      data: {
        tenantId: TENANT,
        principalId: principal.id,
        name: `spec-product-${randomUUID().slice(0, 8)}`,
        basePrice,
      },
      select: { id: true, basePrice: true },
    });
    return { customerId: customer.id, productId: product.id, product };
  }

  describe('create', () => {
    it('maps a product to a customer and resolves the effective price', async () => {
      const { customerId, productId } = await freshPair();

      const row = await service.create(admin, {
        customerId,
        productId,
        customPrice: 123.45,
      });

      expect(row.customerId).toBe(customerId);
      expect(row.productId).toBe(productId);
      expect(row.customPrice).toBe(123.45);
      // The point of resolving it server-side: one answer, not two.
      expect(row.effectivePrice).toBe(123.45);
    });

    it('refuses a duplicate pair with a 409 rather than a raw Prisma error', async () => {
      const { customerId, productId } = await freshPair();
      await service.create(admin, { customerId, productId });

      await expect(
        service.create(admin, { customerId, productId }),
      ).rejects.toMatchObject({ response: { code: 'MAPPING_EXISTS' } });
    });

    it('falls back to the catalog price when no override is given', async () => {
      const { customerId, productId, product } = await freshPair(250);

      const row = await service.create(admin, { customerId, productId });

      expect(row.customPrice).toBeNull();
      expect(row.effectivePrice).toBe(product.basePrice?.toNumber());
    });

    it('404s on a customer id that does not exist in this tenant', async () => {
      const { productId } = await freshPair();

      await expect(
        service.create(admin, { customerId: 'nope', productId }),
      ).rejects.toMatchObject({ response: { code: 'CUSTOMER_NOT_FOUND' } });
    });

    it('404s on a product id that does not exist in this tenant', async () => {
      const { customerId } = await freshPair();

      await expect(
        service.create(admin, { customerId, productId: 'nope' }),
      ).rejects.toMatchObject({ response: { code: 'PRODUCT_NOT_FOUND' } });
    });
  });

  describe('ownership scope', () => {
    it('ignores a salespersonId a sales user sends and binds the mapping to them', async () => {
      const { customerId, productId } = await freshPair();

      const row = await service.create(sales1, {
        customerId,
        productId,
        salespersonId: SALES2, // trying to file it under someone else
      });

      expect(row.salespersonId).toBe(sales1.userId);
    });

    it('lists only the sales user own mappings, whatever ownerId they ask for', async () => {
      const asSales = await service.list(sales1, {
        limit: 100,
        ownerId: SALES2,
      });
      const owners = new Set(asSales.items.map((m) => m.salespersonId));

      expect(asSales.items.length).toBeGreaterThan(0);
      expect([...owners]).toEqual([sales1.userId]);
    });

    it('lets an admin see across salespeople', async () => {
      // Guarantee a second owner rather than relying on test order.
      const { customerId, productId } = await freshPair();
      await service.create(admin, { customerId, productId });

      const asAdmin = await service.list(admin, { limit: 100 });
      const owners = new Set(asAdmin.items.map((m) => m.salespersonId));

      expect(owners.size).toBeGreaterThan(1);
    });

    it('404s — not 403 — when a sales user reaches another owner mapping', async () => {
      const { customerId, productId } = await freshPair();
      const notMine = await service.create(admin, { customerId, productId });

      // 403 would confirm the record exists to someone who should not know it.
      await expect(
        service.update(sales1, notMine.id, { customPrice: 1 }),
      ).rejects.toMatchObject({ response: { code: 'MAPPING_NOT_FOUND' } });
    });

    it('refuses a sales user reassigning their own mapping away', async () => {
      const mine = await service.list(sales1, { limit: 1 });
      expect(mine.items.length).toBeGreaterThan(0);

      await expect(
        service.update(sales1, mine.items[0].id, { salespersonId: SALES2 }),
      ).rejects.toMatchObject({ response: { code: 'REASSIGN_FORBIDDEN' } });
    });
  });

  describe('update', () => {
    it('changes the agreed price and re-resolves the effective price', async () => {
      const { customerId, productId } = await freshPair(250);
      const created = await service.create(admin, { customerId, productId });
      expect(created.effectivePrice).toBe(250);

      const updated = await service.update(admin, created.id, {
        customPrice: 199,
      });

      expect(updated.customPrice).toBe(199);
      expect(updated.effectivePrice).toBe(199);
    });

    it('clears an override back to the catalog price', async () => {
      const { customerId, productId } = await freshPair(250);
      const created = await service.create(admin, {
        customerId,
        productId,
        customPrice: 199,
      });

      const cleared = await service.update(admin, created.id, {
        customPrice: null,
      });

      expect(cleared.customPrice).toBeNull();
      expect(cleared.effectivePrice).toBe(250);
    });
  });

  describe('delete', () => {
    it('refuses while projection lines still resolve through the mapping', async () => {
      const db = prisma.forTenant(TENANT);
      const projection = await db.projection.findFirst({
        select: { mappingId: true },
      });
      if (!projection) throw new Error('acme fixture has no projection');

      await expect(
        service.remove(admin, projection.mappingId),
      ).rejects.toMatchObject({ response: { code: 'MAPPING_IN_USE' } });
    });

    it('soft-deletes an unused mapping and drops it from the list', async () => {
      const { customerId, productId } = await freshPair();
      const created = await service.create(admin, { customerId, productId });

      await service.remove(admin, created.id);

      const after = await service.list(admin, {
        limit: 100,
        customerId,
        productId,
      });
      expect(after.items.map((m) => m.id)).not.toContain(created.id);

      // Soft, not hard: the row survives for audit.
      const raw = await prisma
        .forTenant(TENANT)
        .mapping.findUnique({ where: { id: created.id } });
      expect(raw?.deletedAt).toBeInstanceOf(Date);
    });

    it('still refuses a re-map of the deleted pair — the unique constraint ignores deletedAt', async () => {
      const { customerId, productId } = await freshPair();
      const created = await service.create(admin, { customerId, productId });
      await service.remove(admin, created.id);

      // This is why MAPPING_EXISTS says "edit the existing mapping instead":
      // the duplicate the user is colliding with is invisible to them.
      await expect(
        service.create(admin, { customerId, productId }),
      ).rejects.toMatchObject({ response: { code: 'MAPPING_EXISTS' } });
    });
  });
});
