import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/** A readiness probe must not outlive the orchestrator's own probe timeout. */
const READINESS_QUERY_TIMEOUT_MS = 2_000;

export type HealthState = { status: 'ok' } | { status: 'unavailable' };

/**
 * Liveness and readiness are DIFFERENT questions, and answering them with one
 * endpoint is how a dead system keeps receiving traffic.
 *
 *   LIVENESS  — "is this process alive?"  If no, RESTART it.
 *   READINESS — "can it serve a request?" If no, STOP ROUTING to it.
 *
 * The old `/health` returned a static `{status:'ok'}`. With the database gone
 * it still answered 200, so the load balancer kept sending traffic to an
 * instance that could not answer a single query, and Docker's HEALTHCHECK
 * called it healthy. That is the failure this splits apart.
 *
 * Deliberately NOT reported to the caller: version, dependency names, driver
 * errors, connection strings. A probe is reachable by anyone who can reach the
 * port, so it says only whether it works — the reason goes to the log
 * (B.3.4).
 */
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness. Must touch NOTHING external — a liveness probe that checks the
   * database restarts a perfectly healthy process every time the database
   * hiccups, turning a brief outage into a restart storm.
   */
  liveness(): HealthState {
    return { status: 'ok' };
  }

  /**
   * Readiness. Actually asks the database, under a timeout: a query that hangs
   * would otherwise hold the probe open until the orchestrator's own timeout,
   * which reads as "slow" rather than "not ready".
   */
  async readiness(): Promise<HealthState> {
    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`);
      return { status: 'ok' };
    } catch (error) {
      // Logged in full here, returned as nothing to the caller.
      this.logger.error(
        `Readiness check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { status: 'unavailable' };
    }
  }

  private withTimeout<T>(work: PromiseLike<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              `readiness query exceeded ${READINESS_QUERY_TIMEOUT_MS}ms`,
            ),
          ),
        READINESS_QUERY_TIMEOUT_MS,
      );
      work.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  }
}
