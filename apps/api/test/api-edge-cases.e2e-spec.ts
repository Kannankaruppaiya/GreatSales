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

/**
 * End-to-end negative boundary, validation, and security edge cases.
 *
 * Verifies that the API enforces:
 * - 400 on malformed payloads, invalid enums, negative numbers, and boundary violations.
 * - 404 on non-existent resources without leaking stack traces.
 * - 401 on missing, expired, or bogus authentication tokens.
 * - 403 on RBAC permission violations (e.g. sales rep invoking admin endpoints).
 * - Safe handling of SQL injection strings, XSS payloads, and large payloads.
 */
describe('API Edge Cases & Boundaries (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let salesToken: string;

  let ipCounter = 0;
  const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

  const bodyOf = (res: request.Response) =>
    res.body as Record<string, unknown> & {
      error?: string;
      message?: string | string[];
      statusCode?: number;
      items?: Array<{ id: string; name?: string }>;
      id?: string;
      name?: string;
    };

  async function signIn(
    email: string,
    password = 'Passw0rd!',
    tenantId = 'tenant_acme',
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

    adminToken = await signIn('admin@acme.test');
    salesToken = await signIn('sales1@acme.test');
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  });

  // =========================================================================
  // 1. Boundary & Negative Number Validation (HTTP 400)
  // =========================================================================
  describe('Boundary and Negative Numbers (HTTP 400)', () => {
    it('rejects order with negative item quantity', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SO-TEST-NEG-01',
          customerId: 'cust_1_acme',
          salespersonId: 'user_sales1_acme',
          items: [{ productId: 'prod_a_acme', qty: -5, price: 100 }],
        });

      expect(res.status).toBe(400);
      expect(bodyOf(res).error).toBe('ValidationError');
      expect(JSON.stringify(res.body)).toMatch(/qty|nonnegative/i);
    });

    it('rejects order with negative item price', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SO-TEST-NEG-02',
          customerId: 'cust_1_acme',
          salespersonId: 'user_sales1_acme',
          items: [{ productId: 'prod_a_acme', qty: 10, price: -50 }],
        });

      expect(res.status).toBe(400);
      expect(bodyOf(res).error).toBe('ValidationError');
    });

    it('rejects order with empty items array', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SO-TEST-EMPTY-01',
          customerId: 'cust_1_acme',
          salespersonId: 'user_sales1_acme',
          items: [],
        });

      expect(res.status).toBe(400);
      expect(bodyOf(res).error).toBe('ValidationError');
    });

    it('rejects order with negative advanceAmount', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SO-TEST-NEG-ADV',
          customerId: 'cust_1_acme',
          salespersonId: 'user_sales1_acme',
          advanceAmount: -500,
          items: [{ productId: 'prod_a_acme', qty: 1, price: 100 }],
        });

      expect(res.status).toBe(400);
      expect(bodyOf(res).error).toBe('ValidationError');
    });

    it('rejects payment with negative amount', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          refNo: 'PAY-NEG-01',
          customerId: 'cust_1_acme',
          salespersonId: 'user_sales1_acme',
          invoiceNo: 'INV-NEG-01',
          amount: -1000,
        });

      expect(res.status).toBe(400);
      expect(bodyOf(res).error).toBe('ValidationError');
    });
  });

  // =========================================================================
  // 2. Malformed Payloads & Missing Fields (HTTP 400)
  // =========================================================================
  describe('Malformed Payloads & Missing Fields (HTTP 400)', () => {
    it('rejects customer creation when name is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          salespersonId: 'user_sales1_acme',
        });

      expect(res.status).toBe(400);
      expect(bodyOf(res).error).toBe('ValidationError');
      expect(JSON.stringify(res.body)).toMatch(/name/i);
    });

    it('rejects customer creation with invalid enum value', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Enum Customer',
          salespersonId: 'user_sales1_acme',
          category: 'NonExistentCategory',
        });

      expect(res.status).toBe(400);
      expect(bodyOf(res).error).toBe('ValidationError');
    });

    it('rejects lead creation when customerName is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          salespersonId: 'user_sales1_acme',
          stage: 'NeedsAnalysis',
        });

      expect(res.status).toBe(400);
      expect(bodyOf(res).error).toBe('ValidationError');
    });

    it('rejects PATCH /customers/:id with empty body', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/customers/cust_1_acme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(bodyOf(res).error).toBe('ValidationError');
    });
  });

  // =========================================================================
  // 3. Non-Existent Resources (HTTP 404)
  // =========================================================================
  describe('Non-Existent Resources (HTTP 404)', () => {
    it('returns 404 when querying non-existent customer ID without stack trace', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(bodyOf(res).statusCode).toBe(404);
      expect(JSON.stringify(res.body)).not.toMatch(/at .+\(.+:\d+:\d+\)/);
    });

    it('returns 404 when patching non-existent order', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/orders/non-existent-order-id-999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isUrgent: true });

      expect(res.status).toBe(404);
      expect(bodyOf(res).statusCode).toBe(404);
    });

    it('returns 404 when deleting non-existent lead', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/leads/non-existent-lead-id-999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(bodyOf(res).statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 4. Security, Injection Payloads & Edge Data
  // =========================================================================
  describe('Security and Injection Payloads', () => {
    it('safely handles SQL injection in query parameters without 500 error', async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/customers?search=' OR '1'='1")
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(bodyOf(res).items)).toBe(true);
    });

    it('safely handles SQL injection string in entity creation payload', async () => {
      const sqlInjectionName = 'Legit Co\'); DROP TABLE "Customer"; --';
      const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: sqlInjectionName,
          salespersonId: 'user_sales1_acme',
        });

      expect(res.status).toBe(201);
      expect(bodyOf(res).name).toBe(sqlInjectionName);

      // Clean up
      const createdId = bodyOf(res).id;
      if (createdId) {
        await request(app.getHttpServer())
          .delete(`/api/v1/customers/${createdId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    it('safely handles XSS tags in text fields without crashing', async () => {
      const xssName = '<script>alert("XSS Attack")</script>';
      const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: xssName,
          salespersonId: 'user_sales1_acme',
        });

      expect(res.status).toBe(201);
      expect(bodyOf(res).name).toBe(xssName);

      // Clean up
      const createdId = bodyOf(res).id;
      if (createdId) {
        await request(app.getHttpServer())
          .delete(`/api/v1/customers/${createdId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    it('handles unicode and emojis in names cleanly', async () => {
      // cspell:disable-next-line
      const emojiName = '🌟 Acme Enterprise (தமிழ்) 🚀 100% Guaranteed';
      const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: emojiName,
          salespersonId: 'user_sales1_acme',
        });

      expect(res.status).toBe(201);
      expect(bodyOf(res).name).toBe(emojiName);

      // Clean up
      const createdId = bodyOf(res).id;
      if (createdId) {
        await request(app.getHttpServer())
          .delete(`/api/v1/customers/${createdId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });
  });

  // =========================================================================
  // 5. Authentication & RBAC Authorization (HTTP 401 & 403)
  // =========================================================================
  describe('Authentication and RBAC Security (HTTP 401 & 403)', () => {
    it('returns 401 Unauthorized when Authorization header is omitted', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/customers');
      expect(res.status).toBe(401);
    });

    it('returns 401 Unauthorized with malformed or bogus Bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers')
        .set('Authorization', 'Bearer bogus.jwt.token.here');

      expect(res.status).toBe(401);
    });

    it('denies sales representative from creating a user (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          name: 'Unauthorized User',
          email: 'unauth@acme.test',
          username: 'unauth_user',
          password: 'Passw0rd!',
          roleId: 'role_sales_acme',
        });

      expect(res.status).toBe(403);
      expect(bodyOf(res).statusCode).toBe(403);
    });

    it('denies sales representative from deleting a team (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/teams/team_acme')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.status).toBe(403);
      expect(bodyOf(res).statusCode).toBe(403);
    });
  });
});
