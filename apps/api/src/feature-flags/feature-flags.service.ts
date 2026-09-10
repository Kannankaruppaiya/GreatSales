import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  FEATURE_KEYS,
  inRollout,
  type FeatureFlagMap,
  type FeatureKey,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * How long a resolved answer is trusted, in milliseconds.
 *
 * Every gated write asks this service, so resolving from the database each time
 * would add a query to requests that already know their answer. Half a minute
 * is short enough that switching a feature off takes effect while somebody is
 * still looking at the screen, and long enough that the flag tables are read
 * once per workspace per half minute rather than once per request.
 */
const CACHE_TTL_MS = 30_000;

/**
 * Which features a workspace has.
 *
 * READ ONLY, and deliberately: `greatsales_app` has INSERT, UPDATE and DELETE
 * revoked on both flag tables, which `tenant-isolation.spec` asserts. Changing
 * a flag is the platform operator's job from the platform's own surface. There
 * is no "let a tenant admin toggle this" endpoint here, because a workspace
 * that can switch its own gate off has not been gated.
 */
@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  private cache = new Map<string, { at: number; flags: FeatureFlagMap }>();

  /** Every flag for one workspace, already decided. */
  async resolve(tenantId: string): Promise<FeatureFlagMap> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.flags;

    // Through the TENANT-scoped client. `FeatureFlag` is global, but
    // `TenantFeatureFlag` carries RLS with FORCE — read unscoped, its policy
    // fails closed and every override silently reads as absent, which would
    // hand a workspace a feature it had been switched out of.
    const db = this.prisma.forTenant(tenantId);
    const rows = await db.featureFlag.findMany({
      where: { key: { in: [...FEATURE_KEYS] } },
      include: { tenantOverrides: { where: { tenantId } } },
    });

    const flags = Object.fromEntries(
      FEATURE_KEYS.map((key) => {
        const flag = rows.find((r) => r.key === key);
        // A key with no row has never been rolled out. Off is the only safe
        // answer: a missing flag must not silently enable a feature.
        if (!flag) return [key, false];
        const override = flag.tenantOverrides[0];
        if (override) return [key, override.enabled];
        if (flag.enabledGlobal) return [key, true];
        return [key, inRollout(tenantId, key, flag.rolloutPercent)];
      }),
    ) as FeatureFlagMap;

    this.cache.set(tenantId, { at: Date.now(), flags });
    return flags;
  }

  async isEnabled(tenantId: string, key: FeatureKey): Promise<boolean> {
    return (await this.resolve(tenantId))[key];
  }

  /**
   * Refuse the request when the feature is off.
   *
   * Called from the service that owns the gated write rather than from a route
   * guard: a guard sees the endpoint, and "may this workspace store a GPS pin"
   * is a question about one field on one body, not about PATCH /customers/:id.
   */
  async assertEnabled(tenantId: string, key: FeatureKey): Promise<void> {
    if (!(await this.isEnabled(tenantId, key))) {
      throw new ForbiddenException(
        `The "${key}" feature is switched off for this workspace.`,
      );
    }
  }
}
