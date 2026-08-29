import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { PrismaService } from '../prisma/prisma.service';
import { IndustriesService } from './industries.service';

/**
 * Integration test against the real Dockerized Postgres via the RLS-bound app
 * role. `Industry` is a global (non-tenant) catalogue, so the point of these
 * tests is the opposite of the tenant-scoped services: every tenant must see
 * the SAME rows, and the runtime role reads them despite holding no write grant
 * on the table (lock_global_reference_tables migration).
 */
describe('IndustriesService (integration)', () => {
  let prisma: PrismaService;
  let service: IndustriesService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new IndustriesService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns the seeded catalogue ordered by name, with sub-industries parsed', async () => {
    const rows = await service.list('tenant_acme');

    expect(rows.map((r) => r.name)).toEqual([
      'Automotive',
      'Food & Beverage',
      'Pharmaceutical',
    ]);

    const pharma = rows.find((r) => r.id === 'ind_pharma');
    expect(pharma).toBeDefined();
    expect(pharma?.subIndustries).toEqual(['API', 'Formulation', 'R&D']);
  });

  it('is global — a different tenant sees the identical catalogue (no RLS scoping)', async () => {
    const acme = await service.list('tenant_acme');
    const globex = await service.list('tenant_globex');

    expect(globex).toEqual(acme);
    expect(globex).toHaveLength(3);
  });
});
