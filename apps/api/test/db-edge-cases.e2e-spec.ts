import '../src/load-env';
import { reseedTestDatabase } from '../src/test-support/reseed';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end database, multi-tenancy IDOR, and transaction atomicity tests.
 *
 * Verifies:
 * - IDOR defense: Tenant A can never read, update, or delete Tenant B's records.
 * - Cross-tenant FK defense: Tenant A cannot reference Tenant B's foreign keys.
 * - Transaction atomicity: Failure during nested writes rolls back the entire transaction.
 * - Unique constraint handling: Duplicate role identities return clean 409 Conflict.
 */
describe('Database Multi-Tenancy & Integrity (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let acmeAdminToken: string;

  let ipCounter = 0;
  const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

  const bodyOf = (res: request.Response) =>
    res.body as Record<string, unknown> & {
      statusCode?: number;
      items?: Array<{ code: string }>;
      id?: string;
      code?: string;
    };

  async function signIn(
    email: string,
    tenantId: string,
    password = 'Passw0rd!',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ tenantId, email, password })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    reseedTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    nestApp.set('trust proxy', true);
    app = nestApp as unknown as INestApplication<App>;
    nestApp.use(cookieParser());
    nestApp.setGlobalPrefix('api/v1');
    nestApp.useGlobalFilters(new AllExceptionsFilter());
    await nestApp.init();

    prisma = app.get(PrismaService);
    acmeAdminToken = await signIn('admin@acme.test', 'tenant_acme');
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  });

  // =========================================================================
  // 1. Cross-Tenant IDOR Protection (Row Level Security)
  // =========================================================================
  describe('Multi-Tenant IDOR and Isolation', () => {
    it('prevents Tenant Acme from reading Tenant Globex customer (404 Not Found)', async () => {
      // cust_1_globex belongs to tenant_globex
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers/cust_1_globex')
        .set('Authorization', `Bearer ${acmeAdminToken}`);

      expect(res.status).toBe(404);
      expect(bodyOf(res).statusCode).toBe(404);
    });

    it('prevents Tenant Acme from mutating Tenant Globex customer (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/customers/cust_1_globex')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({ name: 'Hacked Globex Name' });

      expect(res.status).toBe(404);

      // Verify Globex record in DB is unmodified using Globex tenant context
      const globexDb = prisma.forTenant('tenant_globex');
      const globexCust = await globexDb.customer.findUnique({
        where: { id: 'cust_1_globex' },
      });
      expect(globexCust?.name).toBe('Globex Inc Customer One');
    });

    it('prevents Tenant Acme from deleting Tenant Globex customer (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/customers/cust_1_globex')
        .set('Authorization', `Bearer ${acmeAdminToken}`);

      expect(res.status).toBe(404);

      // Verify record still exists in Globex tenant
      const globexDb = prisma.forTenant('tenant_globex');
      const globexCust = await globexDb.customer.findUnique({
        where: { id: 'cust_1_globex' },
      });
      expect(globexCust).not.toBeNull();
      expect(globexCust?.deletedAt).toBeNull();
    });

    it('does not leak Tenant Globex orders in Tenant Acme order list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${acmeAdminToken}`);

      expect(res.status).toBe(200);
      const items = (bodyOf(res).items ?? []) as { code: string }[];
      const globexOrders = items.filter((o) => o.code.includes('GLOBEX'));
      expect(globexOrders).toEqual([]);
    });

    it('rejects creating an order in Tenant Acme referencing Tenant Globex customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          code: 'SO-CROSS-TENANT-ATTEMPT',
          customerId: 'cust_1_globex', // Belongs to Globex!
          salespersonId: 'user_sales1_acme',
          items: [{ productId: 'prod_a_acme', qty: 1, price: 100 }],
        });

      // Must fail to connect or throw error — never associate
      expect(res.status).toBeGreaterThanOrEqual(400);

      // Verify order was not created
      const acmeDb = prisma.forTenant('tenant_acme');
      const order = await acmeDb.salesOrder.findFirst({
        where: { code: 'SO-CROSS-TENANT-ATTEMPT' },
      });
      expect(order).toBeNull();
    });
  });

  // =========================================================================
  // 2. Transaction Atomicity & Rollback on Partial Failures
  // =========================================================================
  describe('Transaction Atomicity & Rollback', () => {
    it('completely rolls back order creation if a line item references a non-existent product', async () => {
      const testOrderCode = 'SO-ROLLBACK-TEST-001';

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          code: testOrderCode,
          customerId: 'cust_1_acme',
          salespersonId: 'user_sales1_acme',
          items: [
            { productId: 'prod_a_acme', qty: 5, price: 100 }, // Valid product
            { productId: 'non-existent-product-id-9999', qty: 2, price: 50 }, // Invalid product!
          ],
        });

      // Request must fail
      expect(res.status).toBeGreaterThanOrEqual(400);

      // Assert that neither the order nor any line items were saved
      const acmeDb = prisma.forTenant('tenant_acme');
      const savedOrder = await acmeDb.salesOrder.findFirst({
        where: { code: testOrderCode },
        include: { items: true },
      });
      expect(savedOrder).toBeNull();

      const orphanedItems = await acmeDb.salesOrderItem.findMany({
        where: { order: { code: testOrderCode } },
      });
      expect(orphanedItems).toEqual([]);
    });
  });

  // =========================================================================
  // 3. Database Unique Constraint Handling (HTTP 409 Conflict)
  // =========================================================================
  describe('Unique Constraint Collision Handling (HTTP 409 Conflict)', () => {
    it('returns 409 Conflict with DUPLICATE_IDENTITY when creating a duplicate role name', async () => {
      const rolePayload = {
        name: 'unique-custom-auditor',
        permissionKeys: ['report.view'],
      };

      // 1. Create the role first time -> should succeed (201)
      const firstRes = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send(rolePayload);

      expect(firstRes.status).toBe(201);
      const roleId = bodyOf(firstRes).id as string;

      try {
        // 2. Attempt to create role with the exact same name -> must fail with 409 Conflict
        const secondRes = await request(app.getHttpServer())
          .post('/api/v1/roles')
          .set('Authorization', `Bearer ${acmeAdminToken}`)
          .send(rolePayload);

        expect(secondRes.status).toBe(409);
        expect(bodyOf(secondRes).code).toBe('DUPLICATE_IDENTITY');
      } finally {
        // 3. Clean up the created role
        if (roleId) {
          await request(app.getHttpServer())
            .delete(`/api/v1/roles/${roleId}`)
            .set('Authorization', `Bearer ${acmeAdminToken}`);
        }
      }
    });
  });
});
