import { Injectable } from '@nestjs/common';
import type {
  DashboardBreakdown,
  DashboardQuery,
  DashboardResponse,
  LeadRow,
  ProjectionLine,
  RequestUser,
} from '@greatsales/shared';
import { ProjectionsService } from '../projections/projections.service';
import { LeadsService } from '../leads/leads.service';

/**
 * Lead stages that no longer count toward committed new-sales value. Everything
 * else in the pipeline still does, including early stages — "committed" here
 * means "not yet dead", which is what the console showed and what the sales
 * team reads it as.
 */
const DEAD_STAGES = new Set(['ClosedLost', 'NoRequirementOrCold']);
/** Stages that are finished, so their follow-ups are not outstanding. */
const CLOSED_LEAD_STAGES = new Set([
  'ClosedWon',
  'ClosedLost',
  'NoRequirementOrCold',
]);
/** Recurring statuses that are finished, for the same reason. */
const CLOSED_PROJ_STATUSES = new Set([
  'Confirmed',
  'Completed',
  'Lost',
  'Cancelled',
]);

/** The four customer categories, always rendered in this order. */
const TIERS = ['Platinum', 'Gold', 'Silver', 'Brass'] as const;

const ORAL_STAGE = 'NegotiationOralConfirmation';
const ORAL_CAP = 20;
const TOP_PROJECTIONS = 10;

@Injectable()
export class DashboardService {
  constructor(
    private readonly projections: ProjectionsService,
    private readonly leads: LeadsService,
  ) {}

  /**
   * One call, one answer. Composes the projections and leads services rather
   * than re-querying, so the money arithmetic has exactly one implementation:
   * `projection-engine` for recurring value, the leads row mapper for deal
   * value. Both already own those numbers.
   */
  async overview(
    user: RequestUser,
    query: DashboardQuery,
  ): Promise<DashboardResponse> {
    const [{ lines, summary }, leadRows] = await Promise.all([
      // lineFilter 'all': the dashboard summarises the whole worksheet, not
      // whatever subset the user last filtered the projections page to.
      this.projections.list(user, {
        period: query.period,
        ownerId: query.ownerId,
        lineFilter: 'all',
      }),
      this.leads.allInScope(user, query.ownerId),
    ]);

    const liveLeads = leadRows.filter((l) => !DEAD_STAGES.has(l.stage));
    const wonLeads = leadRows.filter((l) => l.stage === 'ClosedWon');

    const newSalesCommitted = sum(liveLeads, (l) => l.totalValue);
    const newSalesAchieved = sum(wonLeads, (l) => l.totalValue);

    const recurringCommitted = summary.totCommitted;
    const recurringAchieved = summary.totAchieved;
    const totalCommitted = recurringCommitted + newSalesCommitted;
    const totalAchieved = recurringAchieved + newSalesAchieved;

    const { due, overdue } = this.countFollowUps(lines, leadRows);

    return {
      period: query.period,
      kpis: {
        recurringCommitted,
        recurringAchieved,
        recurringPct: summary.totPct,
        newSalesCommitted,
        newSalesAchieved,
        totalCommitted,
        totalAchieved,
        totalPct: pct(totalAchieved, totalCommitted),
        followUpsDue: due,
        followUpsOverdue: overdue,
      },
      bySalesperson: this.bySalesperson(lines, leadRows),
      byPrincipal: this.byPrincipal(lines),
      byCategory: this.byCategory(lines),
      oralConfirmationDeals: leadRows
        .filter((l) => l.stage === ORAL_STAGE)
        .slice(0, ORAL_CAP),
      oralConfirmationTotal: leadRows.filter((l) => l.stage === ORAL_STAGE)
        .length,
      topOpenProjections: lines
        .filter(
          (p) => p.committedQty > 0 && !CLOSED_PROJ_STATUSES.has(p.status),
        )
        .sort((a, b) => b.projValue - a.projValue)
        .slice(0, TOP_PROJECTIONS),
    };
  }

  /**
   * Due = falls on the tenant's business day. Overdue = before it.
   *
   * "Today" is resolved HERE, once, rather than from a browser clock — two
   * users in different timezones must not see different overdue counts for the
   * same rows. Both sources store the date as `YYYY-MM-DD`, so a string
   * comparison is the correct one and needs no parsing.
   */
  private countFollowUps(
    lines: ProjectionLine[],
    leadRows: LeadRow[],
  ): { due: number; overdue: number } {
    const today = new Date().toISOString().slice(0, 10);
    let due = 0;
    let overdue = 0;

    const tally = (date: string | null, closed: boolean) => {
      if (closed || !date) return;
      if (date < today) overdue++;
      else if (date === today) due++;
    };

    for (const p of lines) {
      tally(p.nextFollowUp, CLOSED_PROJ_STATUSES.has(p.status));
    }
    for (const l of leadRows) {
      tally(l.nextFollowUp, CLOSED_LEAD_STAGES.has(l.stage));
    }
    return { due, overdue };
  }

  /** Recurring + new sales per salesperson, over everyone who appears in either. */
  private bySalesperson(
    lines: ProjectionLine[],
    leadRows: LeadRow[],
  ): DashboardBreakdown[] {
    const names = new Map<string, string>();
    for (const p of lines) names.set(p.salespersonId, p.salespersonName);
    for (const l of leadRows) names.set(l.salespersonId, l.salespersonName);

    return [...names.entries()]
      .map(([id, name]) => {
        const theirLines = lines.filter((p) => p.salespersonId === id);
        const theirLeads = leadRows.filter((l) => l.salespersonId === id);
        return {
          id,
          name,
          committed:
            sum(theirLines, (p) => p.projValue) +
            sum(
              theirLeads.filter((l) => !DEAD_STAGES.has(l.stage)),
              (l) => l.totalValue,
            ),
          achieved:
            sum(theirLines, (p) => p.achValue) +
            sum(
              theirLeads.filter((l) => l.stage === 'ClosedWon'),
              (l) => l.totalValue,
            ),
        };
      })
      .sort((a, b) => b.committed - a.committed);
  }

  /** Recurring only — a lead has no principal to attribute value to. */
  private byPrincipal(lines: ProjectionLine[]): DashboardBreakdown[] {
    const map = new Map<string, DashboardBreakdown>();
    for (const p of lines) {
      const cur = map.get(p.principalId) ?? {
        id: p.principalId,
        name: p.principalName,
        committed: 0,
        achieved: 0,
      };
      cur.committed += p.projValue;
      cur.achieved += p.achValue;
      map.set(p.principalId, cur);
    }
    return [...map.values()]
      .filter((pr) => pr.committed > 0 || pr.achieved > 0)
      .sort((a, b) => b.committed - a.committed);
  }

  /** Always all four tiers, in order, so the chart does not reshape per tenant. */
  private byCategory(lines: ProjectionLine[]) {
    const map = new Map<string, { committed: number; achieved: number }>(
      TIERS.map((t) => [t, { committed: 0, achieved: 0 }]),
    );
    for (const p of lines) {
      // An unset category counts as Silver — the same default the console used.
      const bucket = map.get(p.tier ?? 'Silver') ?? map.get('Silver');
      if (bucket) {
        bucket.committed += p.projValue;
        bucket.achieved += p.achValue;
      }
    }
    return TIERS.map((tier) => ({
      tier,
      committed: map.get(tier)?.committed ?? 0,
      achieved: map.get(tier)?.achieved ?? 0,
    }));
  }
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + (pick(row) || 0), 0);
}

function pct(achieved: number, committed: number): number | null {
  return committed > 0 ? (achieved / committed) * 100 : null;
}
