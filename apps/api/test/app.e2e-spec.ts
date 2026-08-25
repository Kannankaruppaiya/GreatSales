import '../src/load-env'; // MUST be first: without it Prisma loads the
// superuser DATABASE_URL from packages/db/.env and PrismaService refuses
// to start, because a superuser connection bypasses every RLS policy.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Health endpoint. Deployment and orchestration depend on it, so it must be
 * reachable WITHOUT authentication.
 */
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('answers /health without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    const health = res.body as {
      status: string;
      service: string;
      timestamp: string;
    };
    expect(health).toMatchObject({ status: 'ok', service: 'greatsales-api' });
    expect(health.timestamp).toEqual(expect.any(String));
  });

  it('404s an unknown route instead of leaking a stack trace', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at .+\(.+:\d+:\d+\)/);
  });
});
