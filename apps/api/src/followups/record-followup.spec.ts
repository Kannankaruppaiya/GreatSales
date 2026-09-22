import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FollowUpsService } from './followups.service';
import { LeadsService } from '../leads/leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectionsService } from '../projections/projections.service';
import { recordFollowUpId } from './record-followup';

/**
 * The two things this product calls a follow-up, held to one story.
 *
 * `Projection.nextFollowUp` and `Lead.nextFollowUp` are date columns on their
 * own rows; the Follow-ups page, the dashboard tile and the mobile screen list
 * `FollowUp` rows. Setting the date used to write only the column, so a
 * salesperson could log a follow-up on the worksheet and find the Follow-ups
 * page still empty. These tests pin both directions of the mirror.
 */
const admin = (tid: string, roleKey: string): RequestUser => ({
  userId: `user_admin_${roleKey}`,
  tenantId: tid,
  roleId: `role_admin_${roleKey}`,
});

describe('record follow-up mirror (integration)', () => {
  let prisma: PrismaService;
  let projections: ProjectionsService;
  let leads: LeadsService;
  let followUps: FollowUpsService;
  const user = admin('tenant_acme', 'acme');

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    projections = new ProjectionsService(prisma);
    leads = new LeadsService(prisma, new NotificationsService(prisma));
    followUps = new FollowUpsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  /** The seeded Acme worksheet line, found by name rather than by a fixed id. */
  const acmeLine = async () => {
    const res = await projections.list(user, {
      period: '2026-08',
      lineFilter: 'all',
    });
    return res.lines[0];
  };

  const tasksFor = async (entityType: 'Projection' | 'Lead', id: string) =>
    (await followUps.list(user, { entityType, entityId: id, limit: 20 })).items;

  it('puts a projection follow-up date on the follow-ups list', async () => {
    const line = await acmeLine();
    await projections.update(user, line.id, { nextFollowUp: '2026-08-20' });

    const [task, ...rest] = await tasksFor('Projection', line.id);
    expect(rest).toHaveLength(0);
    expect(task.id).toBe(recordFollowUpId('Projection', line.id));
    expect(task.dueDate).toBe('2026-08-20');
    expect(task.done).toBe(false);
    // Owned by the line's salesperson, not by the administrator who typed it.
    expect(task.salespersonId).toBe(line.salespersonId);
    expect(task.title).toBe(`Follow up — ${line.customerName}`);
    expect(task.subtitle).toBe(
      `${line.productName} · ${line.principalName} · ${line.period}`,
    );
    expect(task.amount).toBe(line.projValue);
  });

  it('moves the one task rather than adding another', async () => {
    const line = await acmeLine();
    await projections.update(user, line.id, { nextFollowUp: '2026-08-21' });
    await projections.update(user, line.id, { nextFollowUp: '2026-08-22' });

    const tasks = await tasksFor('Projection', line.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].dueDate).toBe('2026-08-22');
  });

  it('leaves the task alone when a patch does not touch the date', async () => {
    const line = await acmeLine();
    await projections.update(user, line.id, { nextFollowUp: '2026-08-23' });
    await followUps.update(user, recordFollowUpId('Projection', line.id), {
      done: true,
    });

    // A price edit is not a reason to reopen something already ticked off.
    await projections.update(user, line.id, { price: 101 });
    const tasks = await tasksFor('Projection', line.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].done).toBe(true);

    await projections.update(user, line.id, { price: 100 });
  });

  it('clears the worksheet date when the task is completed', async () => {
    const line = await acmeLine();
    await projections.update(user, line.id, { nextFollowUp: '2026-08-24' });
    await followUps.update(user, recordFollowUpId('Projection', line.id), {
      done: true,
    });

    expect((await acmeLine()).nextFollowUp).toBeNull();
  });

  it('removes the task when the date is cleared', async () => {
    const line = await acmeLine();
    await projections.update(user, line.id, { nextFollowUp: '2026-08-25' });
    await projections.update(user, line.id, { nextFollowUp: null });

    expect(await tasksFor('Projection', line.id)).toHaveLength(0);
  });

  it('deleting the task clears the date too', async () => {
    const line = await acmeLine();
    await projections.update(user, line.id, { nextFollowUp: '2026-08-26' });
    await followUps.remove(user, recordFollowUpId('Projection', line.id));

    expect((await acmeLine()).nextFollowUp).toBeNull();
    expect(await tasksFor('Projection', line.id)).toHaveLength(0);
  });

  it('does the same for a lead, from its creation onward', async () => {
    const created = await leads.create(user, {
      customerName: 'Mirror Test Works',
      salespersonId: 'user_sales1_acme',
      stage: 'TrialsAndSampleTests',
      area: 'Ambattur',
      nextFollowUp: '2026-08-27',
    });

    const [task] = await tasksFor('Lead', created.id);
    expect(task.id).toBe(recordFollowUpId('Lead', created.id));
    expect(task.dueDate).toBe('2026-08-27');
    expect(task.title).toBe('Follow up — Mirror Test Works');
    // The stage's PascalCase is split into words for the list.
    expect(task.subtitle).toBe('Trials And Sample Tests · Ambattur');

    await leads.update(user, created.id, { nextFollowUp: '2026-08-28' });
    expect((await tasksFor('Lead', created.id))[0].dueDate).toBe('2026-08-28');

    await leads.remove(user, created.id);
    expect(await tasksFor('Lead', created.id)).toHaveLength(0);
  });

  it('leaves a hand-written follow-up on the same record alone', async () => {
    const line = await acmeLine();
    const byHand = await followUps.create(user, {
      entityType: 'Projection',
      entityId: line.id,
      dueDate: '2026-08-29',
      title: 'Ad-hoc call',
    });
    await projections.update(user, line.id, { nextFollowUp: '2026-08-30' });

    const tasks = await tasksFor('Projection', line.id);
    expect(tasks).toHaveLength(2);
    // Completing the mirrored one must not touch the record via the other.
    await projections.update(user, line.id, { nextFollowUp: null });
    const left = await tasksFor('Projection', line.id);
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe(byHand.id);

    await followUps.remove(user, byHand.id);
  });
});
