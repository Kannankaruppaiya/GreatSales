import type { TenantPrisma } from '../prisma/prisma.service';

/**
 * Keeps a record's own `nextFollowUp` date column and the `FollowUp` table
 * telling the same story.
 *
 * Two things in this product were both called a follow-up and neither knew
 * about the other. `Projection.nextFollowUp` and `Lead.nextFollowUp` are date
 * columns on their own rows, written by the worksheet's "Log follow-up" button
 * and the lead editor's "Next follow-up" field. `FollowUp` is a table of tasks
 * pointing at records, and it is what the Follow-ups page, the dashboard tile
 * and the mobile screen all list. So a salesperson could set a follow-up date
 * on a projection, see it in the worksheet, and find the Follow-ups page still
 * empty — the page was not wrong, it was reading the other thing.
 *
 * Rather than have two answers, setting the date column now also writes the
 * task. The mirrored task gets a DERIVED id, {@link recordFollowUpId}, so the
 * write is an upsert of one row instead of a new task per edit, and so the
 * reverse direction can recognise its own rows without a schema column:
 * completing or deleting the mirrored task clears the date column, which is
 * what stops the worksheet from showing a date for something already done.
 *
 * A task the user creates by hand against the same record (Follow-ups page →
 * Add Follow-Up) gets an ordinary cuid and is left alone by all of this. One
 * record can carry both: the scheduled next touch, and any number of ad-hoc
 * tasks about it.
 */

/** The record kinds that carry their own `nextFollowUp` date column. */
export type RecordFollowUpEntity = 'Projection' | 'Lead';

const PREFIX: Record<RecordFollowUpEntity, string> = {
  Projection: 'fu_proj_',
  Lead: 'fu_lead_',
};

/** The id of the mirrored task for a record. Derived, so it upserts. */
export function recordFollowUpId(
  entityType: RecordFollowUpEntity,
  entityId: string,
): string {
  return `${PREFIX[entityType]}${entityId}`;
}

/**
 * The record behind a mirrored task id, or null for an ordinary follow-up.
 * Used by the Follow-ups service to tell "this task IS a record's date column"
 * from "this task is a note somebody wrote about a record".
 */
export function recordBehindFollowUpId(
  id: string,
): { entityType: RecordFollowUpEntity; entityId: string } | null {
  for (const entityType of ['Projection', 'Lead'] as const) {
    const prefix = PREFIX[entityType];
    if (id.startsWith(prefix) && id.length > prefix.length) {
      return { entityType, entityId: id.slice(prefix.length) };
    }
  }
  return null;
}

export interface RecordFollowUpInput {
  entityType: RecordFollowUpEntity;
  entityId: string;
  /** The record's owner — the task lands on their list, not the editor's. */
  salespersonId: string;
  /** `null` clears the follow-up: the mirrored task is removed. */
  dueDate: Date | null;
  title: string;
  subtitle: string | null;
  amount?: number | null;
}

/**
 * Write the mirrored task for a record, or remove it when the date is cleared.
 *
 * Call this ONLY when the caller actually touched `nextFollowUp`. A patch that
 * changes a price must not reopen a task the salesperson already ticked off,
 * and restricting the call site to the field's own branch is what guarantees
 * that without this function having to guess.
 */
export async function syncRecordFollowUp(
  db: TenantPrisma,
  tenantId: string,
  input: RecordFollowUpInput,
): Promise<void> {
  const id = recordFollowUpId(input.entityType, input.entityId);

  if (input.dueDate === null) {
    // deleteMany, not delete: "there was no date and there still isn't" is the
    // common case and is not an error.
    await db.followUp.deleteMany({ where: { id } });
    return;
  }

  const fields = {
    dueDate: input.dueDate,
    title: input.title,
    subtitle: input.subtitle,
    amount: input.amount ?? null,
    // Moving the date is scheduling the next touch, so the task is open again.
    done: false,
  };

  await db.followUp.upsert({
    where: { id },
    create: {
      id,
      tenant: { connect: { id: tenantId } },
      salesperson: { connect: { id: input.salespersonId } },
      entityType: input.entityType,
      entityId: input.entityId,
      ...fields,
    },
    update: {
      salesperson: { connect: { id: input.salespersonId } },
      ...fields,
    },
  });
}

/**
 * Remove a record's mirrored task. For the delete paths: a projection or lead
 * that is gone must not leave a task pointing at it on somebody's list.
 */
export async function clearRecordFollowUp(
  db: TenantPrisma,
  entityType: RecordFollowUpEntity,
  entityId: string,
): Promise<void> {
  await db.followUp.deleteMany({
    where: { id: recordFollowUpId(entityType, entityId) },
  });
}
