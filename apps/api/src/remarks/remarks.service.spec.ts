import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RemarksService } from './remarks.service';
import { CustomersService } from '../customers/customers.service';

/**
 * Remarks carry no permission key of their own — they inherit the parent
 * record's. That indirection is the whole risk surface here, so these tests
 * pin both halves of it: the ROLE must hold the parent's permission, and the
 * parent ROW must be one this caller could have opened.
 *
 * Without the second half a sales user could read every rep's commentary by
 * guessing ids, while every permission check still passed.
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

const ACME = 'tenant_acme';

describe('RemarksService (integration)', () => {
  let prisma: PrismaService;
  let service: RemarksService;
  let customers: CustomersService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new RemarksService(prisma);
    customers = new CustomersService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  /** A customer id the given caller can see. */
  const someCustomerId = async (user: RequestUser): Promise<string> => {
    const page = await customers.list(user, { limit: 20 });
    expect(page.items.length).toBeGreaterThan(0);
    return page.items[0].id;
  };

  it('round-trips a note and attributes it to the caller', async () => {
    const user = admin(ACME, 'acme');
    const entityId = await someCustomerId(user);

    const created = await service.create(user, {
      entityType: 'Customer',
      entityId,
      text: 'Agreed 45-day terms on the call.',
    });
    expect(created.userId).toBe(user.userId);
    expect(created.userName).toBeTruthy();

    const page = await service.list(user, {
      entityType: 'Customer',
      entityId,
      limit: 50,
    });
    expect(page.total).toBeGreaterThan(0);
    expect(page.items[0].text).toBe('Agreed 45-day terms on the call.');
  });

  it('refuses a note on a record the caller cannot reach', async () => {
    const owner = sales(ACME, 'acme', 1);
    const otherRep = sales(ACME, 'acme', 2);
    const entityId = await someCustomerId(owner);

    await expect(
      service.create(otherRep, {
        entityType: 'Customer',
        entityId,
        text: 'should never land',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.list(otherRep, { entityType: 'Customer', entityId, limit: 50 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses an id that belongs to another tenant', async () => {
    const acmeAdmin = admin(ACME, 'acme');
    const globexAdmin = admin('tenant_globex', 'globex');
    const acmeCustomer = await someCustomerId(acmeAdmin);

    await expect(
      service.list(globexAdmin, {
        entityType: 'Customer',
        entityId: acmeCustomer,
        limit: 50,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses an entity id that does not exist at all', async () => {
    await expect(
      service.create(admin(ACME, 'acme'), {
        entityType: 'Lead',
        entityId: 'no_such_lead',
        text: 'orphan',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
