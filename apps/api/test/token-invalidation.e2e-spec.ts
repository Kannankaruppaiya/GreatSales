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
 * Access-token invalidation contract (finding P1).
 *
 * Signature + TTL alone leave an access token authorized for the rest of its
 * ~15m life after the account behind it changes. JwtAuthGuard now re-checks the
 * live row on every request — active/deletedAt, and a `tokenVersion` bumped by
 * role change / password reset — so a stale token is refused AT ONCE. Own DB
 * reseed + app, so nothing here depends on another suite's ordering.
 */
const TENANT = 'tenant_acme';
const ME = '/api/v1/auth/me';
const USERS = '/api/v1/users';

let app: INestApplication<App>;
let ipCounter = 0;
const nextIp = () => `203.0.113.${(ipCounter++ % 250) + 1}`;

async function signIn(email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', nextIp())
    .send({ tenantId: TENANT, email, password: 'Passw0rd!' })
    .expect(201);
  return (res.body as { accessToken: string }).accessToken;
}

const me = (token: string) =>
  request(app.getHttpServer()).get(ME).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  reseedTestDatabase();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  (app as NestExpressApplication).set('trust proxy', 1);
  await app.init();
}, 240_000);

afterAll(async () => {
  await app.close();
});

describe('access-token invalidation', () => {
  it('refuses an outstanding token the moment the user is deactivated', async () => {
    const admin = await signIn('admin@acme.test');
    const target = await signIn('sales2@acme.test');
    await me(target).expect(200); // valid right now

    await request(app.getHttpServer())
      .patch(`${USERS}/user_sales2_acme`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ active: false })
      .expect(200);

    // Not in ~15m — now.
    await me(target).expect(401);
  });

  it('refuses an outstanding token the moment the user’s role changes (tokenVersion)', async () => {
    const admin = await signIn('admin@acme.test');
    const target = await signIn('sales1@acme.test');
    await me(target).expect(200);

    // Role change bumps tokenVersion; the user stays active, so this isolates
    // the version check from the active check above.
    await request(app.getHttpServer())
      .patch(`${USERS}/user_sales1_acme`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ roleId: 'role_mgmt_acme' })
      .expect(200);

    await me(target).expect(401);

    // A fresh login mints a token at the new version, which works again — the
    // invalidation is version-scoped, not a lockout.
    const reissued = await signIn('sales1@acme.test');
    await me(reissued).expect(200);
  });
});
