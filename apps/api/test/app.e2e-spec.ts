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
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers /health/ready without a token, and reaches the database', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('tells the probes nothing beyond whether it works', async () => {
    // A probe is reachable by anyone who can reach the port. It used to name
    // the service and echo a timestamp; version, dependency names and driver
    // errors must never appear here either (B.3.4).
    for (const path of ['/api/v1/health', '/api/v1/health/ready']) {
      const body = JSON.stringify(
        (await request(app.getHttpServer()).get(path)).body,
      );
      expect(Object.keys(JSON.parse(body) as object)).toEqual(['status']);
      expect(body).not.toMatch(/greatsales|postgres|prisma|version/i);
    }
  });

  it('404s an unknown route instead of leaking a stack trace', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at .+\(.+:\d+:\d+\)/);
  });
});
