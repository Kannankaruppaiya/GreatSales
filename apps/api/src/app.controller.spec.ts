import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

/**
 * The behaviour under test is the one that was missing: a readiness probe that
 * answers 200 with a dead database keeps the load balancer sending traffic to
 * an instance that cannot serve a single request.
 */
describe('AppController — health', () => {
  let controller: AppController;
  let queryRaw: jest.Mock;

  const makeRes = () => {
    const res = { status: jest.fn() };
    return res as unknown as Response & { status: jest.Mock };
  };

  beforeEach(async () => {
    queryRaw = jest.fn();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();
    controller = app.get(AppController);
  });

  describe('liveness', () => {
    it('reports ok', () => {
      expect(controller.health()).toEqual({ status: 'ok' });
    });

    it('does NOT touch the database — a DB blip must not restart the process', () => {
      controller.health();
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('answers ok and 200 when the database responds', async () => {
      queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      const res = makeRes();

      await expect(controller.ready(res)).resolves.toEqual({ status: 'ok' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('answers 503 when the database is unreachable', async () => {
      queryRaw.mockRejectedValue(new Error('connection refused'));
      const res = makeRes();

      await expect(controller.ready(res)).resolves.toEqual({
        status: 'unavailable',
      });
      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('answers 503 when the database hangs, rather than hanging with it', async () => {
      queryRaw.mockReturnValue(new Promise(() => {})); // never settles
      const res = makeRes();

      await expect(controller.ready(res)).resolves.toEqual({
        status: 'unavailable',
      });
      expect(res.status).toHaveBeenCalledWith(503);
    }, 10_000);

    it('leaks no driver detail to the caller — the reason goes to the log only', async () => {
      queryRaw.mockRejectedValue(
        new Error('password authentication failed for user "greatsales_app"'),
      );
      const res = makeRes();

      const body = await controller.ready(res);
      expect(JSON.stringify(body)).not.toContain('greatsales_app');
      expect(JSON.stringify(body)).not.toContain('password');
    });
  });
});
