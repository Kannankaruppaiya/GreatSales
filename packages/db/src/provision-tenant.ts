/**
 * Create a tenant and its first admin on a PRODUCTION database.
 *
 * The three seed scripts were the only way to bring a tenant into existence,
 * and every one of them TRUNCATES the whole database before inserting — which
 * is why they are refused outside development. That left no way at all to
 * onboard a paying customer: a fresh production database had no tenant, no
 * roles and no user, so nobody could sign in.
 *
 * This script is the opposite of a seed. It INSERTS ONLY:
 *   * it never truncates or deletes,
 *   * it refuses to touch a tenant id that already exists,
 *   * the global permission catalogue is upserted, so running it for a second
 *     tenant does not disturb the first.
 *
 *   pnpm db:provision -- --tenant acme --name "Acme Industrial" \
 *                        --admin-email ops@acme.com --admin-name "Ops"
 *
 * The admin password is generated and printed ONCE. It is stored with
 * mustChangePassword set, so it is a hand-over secret rather than a
 * credential: the guard forces a replacement at first sign-in.
 */
import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_PERMISSIONS } from '@greatsales/shared';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function requireArg(name: string): string {
  const v = arg(name);
  if (!v) {
    console.error(`Missing --${name}`);
    console.error(
      'Usage: pnpm db:provision -- --tenant <slug> --name "<Company>" ' +
        '--admin-email <email> [--admin-name "<Name>"] [--region <region>]',
    );
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const slug = requireArg('tenant');
  const companyName = requireArg('name');
  const adminEmail = requireArg('admin-email').toLowerCase();
  const adminName = arg('admin-name') ?? 'Administrator';
  const region = arg('region') ?? 'IN';

  if (!/^[a-z0-9_]+$/.test(slug)) {
    throw new Error(
      `--tenant must be lowercase letters, digits and underscores: got "${slug}"`,
    );
  }

  const tenantId = slug.startsWith('tenant_') ? slug : `tenant_${slug}`;
  const key = tenantId.replace(/^tenant_/, '');

  const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (existing) {
    throw new Error(
      `Tenant "${tenantId}" already exists (created ${existing.createdAt.toISOString()}). ` +
        'Refusing to touch it — provisioning only ever creates.',
    );
  }

  // The permission catalogue is global, not per tenant. upsert so provisioning
  // a second tenant neither duplicates rows nor fails on the first one's.
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, module: p.module },
      update: { module: p.module },
    });
  }
  const perms = await prisma.permission.findMany({
    select: { id: true, key: true },
  });
  const permId = (k: string): string => {
    const found = perms.find((p) => p.key === k);
    if (!found) throw new Error(`Permission "${k}" missing from the catalogue`);
    return found.id;
  };

  // A generated password, shown once. Long enough that it does not matter if
  // it is never changed by an admin who ignores the prompt — though the
  // mustChangePassword guard means they cannot ignore it.
  const password = randomBytes(12).toString('base64url');
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.$transaction(async (tx) => {
    await tx.tenant.create({
      data: {
        id: tenantId,
        name: companyName,
        plan: 'free',
        status: 'Active',
        region,
      },
    });

    for (const role of ['admin', 'mgmt', 'sales'] as const) {
      await tx.role.create({
        data: {
          id: `role_${role}_${key}`,
          tenantId,
          name: role,
          isSystem: true,
        },
      });
      await tx.rolePermission.createMany({
        data: ROLE_PERMISSIONS[role].map((k) => ({
          roleId: `role_${role}_${key}`,
          permissionId: permId(k),
        })),
      });
    }

    await tx.user.create({
      data: {
        tenantId,
        name: adminName,
        email: adminEmail,
        username: adminEmail,
        passwordHash,
        roleId: `role_admin_${key}`,
        // The password below is known to whoever runs this script, so it is a
        // shared secret until the admin replaces it. The guard enforces that
        // at first sign-in rather than trusting them to remember.
        mustChangePassword: true,
      },
    });
  });

  console.log('');
  console.log('  Tenant provisioned');
  console.log('  ------------------------------------------------');
  console.log(`  Workspace ID   ${tenantId}`);
  console.log(`  Company        ${companyName}`);
  console.log(`  Admin email    ${adminEmail}`);
  console.log(`  Password       ${password}`);
  console.log('  ------------------------------------------------');
  console.log('  Shown once. The admin must change it at first sign-in.');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
