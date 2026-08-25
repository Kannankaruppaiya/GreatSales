import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from './teams.service';

/**
 * Team administration.
 *
 * The rule worth the most attention is that deleting a team DETACHES its
 * members in the same transaction. Without it, `User.teamId` would point at a
 * team absent from every list, and the users table would keep rendering a team
 * name for a team that no longer exists — a lie with no way to correct it.
 */
const ACME: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
};

let prisma: PrismaService;
let service: TeamsService;

beforeAll(async () => {
  prisma = new PrismaService(process.env.DATABASE_URL as string);
  await prisma.onModuleInit();
  service = new TeamsService(prisma);
}, 120_000);

beforeEach(() => {
  execSync('pnpm --filter @greatsales/db db:seed', {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe('list', () => {
  it('lists both seeded teams with manager name and member count', async () => {
    const teams = await service.list(ACME);
    const primary = teams.find((t) => t.id === 'team_acme')!;

    expect(primary.managerName).toBe('Acme Corp Manager');
    const actual = await prisma.forTenant('tenant_acme').user.count({
      where: { teamId: 'team_acme', deletedAt: null },
    });
    expect(primary.memberCount).toBe(actual);
    expect(teams.some((t) => t.id === 'team_secondary_acme')).toBe(true);
  });

  it('isolates tenants — Globex teams are invisible to an Acme caller', async () => {
    const teams = await service.list(ACME);
    expect(teams.some((t) => t.id.endsWith('_globex'))).toBe(false);
  });
});

describe('create', () => {
  it('creates a team with a resolved manager name', async () => {
    const team = await service.create(ACME, {
      name: 'Northern Region',
      managerId: 'user_mgr_acme',
    });
    expect(team.managerName).toBe('Acme Corp Manager');
    expect(team.memberCount).toBe(0);
  });

  it('rejects a manager from another tenant', async () => {
    await expect(
      service.create(ACME, { name: 'Cross', managerId: 'user_mgr_globex' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_MANAGER' },
    });
  });

  it('rejects an inactive manager', async () => {
    await prisma
      .forTenant('tenant_acme')
      .user.update({ where: { id: 'user_mgr_acme' }, data: { active: false } });

    await expect(
      service.create(ACME, { name: 'Inactive', managerId: 'user_mgr_acme' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_MANAGER' } });
  });

  it('rejects a soft-deleted manager', async () => {
    await prisma.forTenant('tenant_acme').user.update({
      where: { id: 'user_mgr_acme' },
      data: { deletedAt: new Date() },
    });

    await expect(
      service.create(ACME, { name: 'Deleted', managerId: 'user_mgr_acme' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_MANAGER' } });
  });

  it('rejects an entirely unknown manager id — 400, not 500', async () => {
    await expect(
      service.create(ACME, { name: 'Nobody', managerId: 'user_nope' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('update', () => {
  it('renames a team', async () => {
    await expect(
      service.update(ACME, 'team_acme', { name: 'Renamed Team' }),
    ).resolves.toMatchObject({ name: 'Renamed Team' });
  });

  it('changes the manager and reflects the new name', async () => {
    const updated = await service.update(ACME, 'team_acme', {
      managerId: 'user_admin_acme',
    });
    expect(updated.managerName).toBe('Acme Corp Admin');
  });

  it('rejects a manager from another tenant', async () => {
    await expect(
      service.update(ACME, 'team_acme', { managerId: 'user_mgr_globex' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_MANAGER' } });
  });

  it('404s a team in another tenant', async () => {
    await expect(
      service.update(ACME, 'team_globex', { name: 'Hijack' }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'TEAM_NOT_FOUND' },
    });
  });
});

describe('delete', () => {
  it('soft-deletes the team AND detaches every member', async () => {
    const before = await service.members(ACME, 'team_acme');
    expect(before.length).toBeGreaterThan(0);

    await service.remove(ACME, 'team_acme');

    const teams = await service.list(ACME);
    expect(teams.some((t) => t.id === 'team_acme')).toBe(false);

    for (const member of before) {
      const row = await prisma
        .forTenant('tenant_acme')
        .user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.teamId).toBeNull();
    }
  });

  it('detaching is not deleting — every member is still a user', async () => {
    const before = await service.members(ACME, 'team_acme');
    await service.remove(ACME, 'team_acme');

    for (const member of before) {
      const row = await prisma
        .forTenant('tenant_acme')
        .user.findUniqueOrThrow({ where: { id: member.id } });
      expect(row.deletedAt).toBeNull();
      expect(row.active).toBe(true);
    }
  });

  it('404s a team in another tenant', async () => {
    await expect(service.remove(ACME, 'team_globex')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('membership', () => {
  it('adds members in bulk and updates the count', async () => {
    const result = await service.addMembers(ACME, 'team_secondary_acme', {
      userIds: ['user_bulk_acme_01', 'user_bulk_acme_02'],
    });
    expect(result).toEqual({ added: 2 });

    const teams = await service.list(ACME);
    expect(teams.find((t) => t.id === 'team_secondary_acme')?.memberCount).toBe(
      2,
    );
  });

  it('moving a member between teams updates BOTH counts', async () => {
    const countOf = async (id: string) =>
      (await service.list(ACME)).find((t) => t.id === id)!.memberCount;

    const sourceBefore = await countOf('team_acme');
    await service.addMembers(ACME, 'team_secondary_acme', {
      userIds: ['user_sales1_acme'],
    });

    expect(await countOf('team_acme')).toBe(sourceBefore - 1);
    expect(await countOf('team_secondary_acme')).toBe(1);
  });

  it('is idempotent — re-adding an existing member is a no-op, not an error', async () => {
    await service.addMembers(ACME, 'team_secondary_acme', {
      userIds: ['user_bulk_acme_01'],
    });
    const again = await service.addMembers(ACME, 'team_secondary_acme', {
      userIds: ['user_bulk_acme_01'],
    });
    expect(again).toEqual({ added: 0 });
  });

  it('rejects the WHOLE batch when any id is unknown', async () => {
    await expect(
      service.addMembers(ACME, 'team_secondary_acme', {
        userIds: ['user_bulk_acme_01', 'user_does_not_exist'],
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_REFERENCE' },
    });

    // And the valid half must NOT have been applied.
    const teams = await service.list(ACME);
    expect(teams.find((t) => t.id === 'team_secondary_acme')?.memberCount).toBe(
      0,
    );
  });

  it('rejects a cross-tenant user id', async () => {
    await expect(
      service.addMembers(ACME, 'team_secondary_acme', {
        userIds: ['user_sales1_globex'],
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_REFERENCE' } });
  });

  it('removes one member without deleting them', async () => {
    await service.removeMember(ACME, 'team_acme', 'user_sales1_acme');

    const row = await prisma
      .forTenant('tenant_acme')
      .user.findUniqueOrThrow({ where: { id: 'user_sales1_acme' } });
    expect(row.teamId).toBeNull();
    expect(row.deletedAt).toBeNull();
  });

  it('removing a non-member is a no-op, not an error', async () => {
    await expect(
      service.removeMember(ACME, 'team_secondary_acme', 'user_sales1_acme'),
    ).resolves.toBeUndefined();
  });

  it('404s membership operations on a team in another tenant', async () => {
    await expect(
      service.addMembers(ACME, 'team_globex', {
        userIds: ['user_sales1_acme'],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('lists members without any password hash', async () => {
    const members = await service.members(ACME, 'team_acme');
    expect(members.length).toBeGreaterThan(0);
    expect(JSON.stringify(members)).not.toMatch(/passwordHash|\$argon2/);
  });

  it('writes audit rows for team changes', async () => {
    const team = await service.create(ACME, {
      name: 'Audited Team',
      managerId: 'user_mgr_acme',
    });
    await service.update(ACME, team.id, { name: 'Audited Team Renamed' });
    await service.remove(ACME, team.id);

    const rows = await prisma.forTenant('tenant_acme').auditLog.findMany({
      where: { entity: 'Team', entityId: team.id },
      orderBy: { at: 'asc' },
    });
    expect(rows.map((r) => r.action)).toEqual([
      'team.created',
      'team.updated',
      'team.deleted',
    ]);
  });
});
