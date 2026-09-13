import { Injectable } from '@nestjs/common';
import {
  monthsInRange,
  type DashboardBreakdown,
  type DashboardFollowUp,
  type DashboardQuery,
  type DashboardResponse,
  type FollowUpRow,
  type LeadRow,
  type ProjectionLine,
  type RequestUser,
} from '@greatsales/shared';
import { ProjectionsService } from '../projections/projections.service';
import { LeadsService } from '../leads/leads.service';
import { TargetsService } from '../targets/targets.service';
import { FollowUpsService } from '../followups/followups.service';
import { businessToday } from '../common/business-day';

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
/** How many outstanding follow-ups the card's list carries. The COUNT is whole. */
const FOLLOWUP_CAP = 50;

/** Whole days from `day` to `today`, both `YYYY-MM-DD`. Negative in the future. */
function daysBetween(day: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly projections: ProjectionsService,
    private readonly leads: LeadsService,
    private readonly targets: TargetsService,
    private readonly followUps: FollowUpsService,
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
    // The monthly tables are keyed by period, so a window becomes the months it
    // touches — a week resolves to the one month containing it, because a
    // recurring commitment IS a month and there is no Tuesday's worth of one.
    const months = monthsInRange(query.from, query.to);

    // "Today" is resolved once, here, and handed to everything that needs it.
    // Asking the clock twice inside one response is how a request that spans
    // midnight reports the same follow-up as both due and overdue — and it is
    // the BUSINESS's day, not UTC's, which is a different date for the five and
    // a half hours after midnight here.
    const today = businessToday();

    const [{ lines, summary }, leadRows, targets, followUps] =
      await Promise.all([
        // lineFilter 'all': the dashboard summarises the whole worksheet, not
        // whatever subset the user last filtered the projections page to.
        this.projections.forPeriods(user, months, {
          ownerId: query.ownerId,
          lineFilter: 'all',
        }),
        this.leads.allInScope(user, query.ownerId),
        // Scoped by the same rules as everything else on this page: a sales
        // user gets their own target regardless of the ownerId they asked for.
        this.targets.totalFor(user, months, query.ownerId),
        // The follow-up list itself, from the service that owns it — the same
        // rows the Follow-ups page shows, scoped by the same rules.
        this.followUps.outstanding(user, query.ownerId, today),
      ]);

    /**
     * New sales, scoped to the WINDOW.
     *
     * This half used not to be scoped at all: every non-dead lead counted,
     * whatever month was selected, so the same pipeline total appeared under
     * every entry in the month dropdown and the picker looked broken because it
     * was doing nothing. With a window that can be a day, the question has to
     * have a date in it.
     *
     * Committed is what was RAISED in the window — new business brought in —
     * and achieved is what was WON in it. Two different dates, deliberately: a
     * deal raised in June and won in September belongs to June's intake and
     * September's result, and counting it in one month for both would make the
     * two columns describe different populations.
     */
    const inWindow = (iso: string | null | undefined) => {
      if (!iso) return false;
      const day = iso.slice(0, 10);
      return day >= query.from && day <= query.to;
    };

    const raisedLeads = leadRows.filter(
      (l) => !DEAD_STAGES.has(l.stage) && inWindow(l.createdAt),
    );
    const wonLeads = leadRows.filter(
      (l) =>
        l.stage === 'ClosedWon' && inWindow(l.stageUpdatedAt ?? l.updatedAt),
    );

    const newSalesCommitted = sum(raisedLeads, (l) => l.totalValue);
    const newSalesAchieved = sum(wonLeads, (l) => l.totalValue);

    const recurringCommitted = summary.totCommitted;
    const recurringAchieved = summary.totAchieved;
    const totalCommitted = recurringCommitted + newSalesCommitted;
    const totalAchieved = recurringAchieved + newSalesAchieved;

    const { due, overdue, items } = this.countFollowUps(followUps, today);

    return {
      from: query.from,
      to: query.to,
      months,
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
        target: targets.total,
        targetPct: targets.total ? pct(totalAchieved, targets.total) : null,
      },
      bySalesperson: this.bySalesperson(
        lines,
        raisedLeads,
        wonLeads,
        targets.byPerson,
      ),
      byPrincipal: this.byPrincipal(lines),
      byCategory: this.byCategory(lines),
      // A SNAPSHOT, not a window figure: "which deals are at oral confirmation"
      // is a question about where the pipeline stands now, and scoping it to a
      // week would empty a list whose whole job is to be actionable today.
      oralConfirmationDeals: leadRows
        .filter((l) => l.stage === ORAL_STAGE)
        .slice(0, ORAL_CAP),
      oralConfirmationTotal: leadRows.filter((l) => l.stage === ORAL_STAGE)
        .length,
      followUps: items.slice(0, FOLLOWUP_CAP),
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
   * "Today" is resolved by the caller, once, rather than from a browser clock —
   * two users in different timezones must not see different overdue counts for
   * the same rows.
   *
   * A follow-up in this product is a `FollowUp` row pointing at a record, which
   * is what the Follow-ups page and the mobile screen both list. This used to
   * count the `nextFollowUp` DATE COLUMNS on leads and recurring lines instead,
   * so the tile could read "8 overdue" while that page held nothing and a
   * follow-up created on it moved no number here. Those columns are dates on
   * their own records, shown on their own pages, and are not counted.
   */
  private countFollowUps(
    rows: FollowUpRow[],
    today: string,
  ): { due: number; overdue: number; items: DashboardFollowUp[] } {
    let due = 0;
    let overdue = 0;
    const items: DashboardFollowUp[] = [];

    for (const f of rows) {
      const day = f.dueDate.slice(0, 10);
      // The service returned nothing later than today, but the boundary is
      // cheap to restate and the alternative is a silent miscount.
      if (day > today) continue;
      if (day < today) overdue++;
      else due++;
      items.push({
        id: f.id,
        entityType: f.entityType,
        entityId: f.entityId,
        title: f.title ?? f.subtitle ?? `${f.entityType} follow-up`,
        subtitle: f.title ? f.subtitle : null,
        ownerName: f.salespersonName,
        dueDate: day,
        daysOverdue: daysBetween(day, today),
        amount: f.amount,
      });
    }

    items.sort(
      (a, b) => b.daysOverdue - a.daysOverdue || a.title.localeCompare(b.title),
    );
    return { due, overdue, items };
  }

  /**
   * Recurring + new sales per salesperson, over everyone who appears in any of
   * the three.
   *
   * `raised` and `won` arrive already scoped to the window and already split by
   * WHICH date put them there — the split is made once in `overview` so this
   * chart and the KPI cards above it cannot come to different answers about the
   * same window.
   */
  private bySalesperson(
    lines: ProjectionLine[],
    raised: LeadRow[],
    won: LeadRow[],
    targetByPerson: Map<string, number>,
  ): DashboardBreakdown[] {
    const names = new Map<string, string>();
    for (const p of lines) names.set(p.salespersonId, p.salespersonName);
    for (const l of raised) names.set(l.salespersonId, l.salespersonName);
    for (const l of won) names.set(l.salespersonId, l.salespersonName);
    // Somebody with a target and nothing else still belongs on the chart: "no
    // activity against a target" is the row a manager most needs to see.
    for (const id of targetByPerson.keys()) {
      if (!names.has(id)) names.set(id, '—');
    }

    return [...names.entries()]
      .map(([id, name]) => ({
        id,
        name,
        // Absent, not zero, when this person has no target for the window — an
        // unset target must not render as a missed one.
        target: targetByPerson.get(id) ?? null,
        committed:
          sum(
            lines.filter((p) => p.salespersonId === id),
            (p) => p.projValue,
          ) +
          sum(
            raised.filter((l) => l.salespersonId === id),
            (l) => l.totalValue,
          ),
        achieved:
          sum(
            lines.filter((p) => p.salespersonId === id),
            (p) => p.achValue,
          ) +
          sum(
            won.filter((l) => l.salespersonId === id),
            (l) => l.totalValue,
          ),
      }))
      .sort((a, b) => b.committed - a.committed);
  }

  /** Recurring only — a lead has no principal to attribute value to. */
  private byPrincipal(lines: ProjectionLine[]): DashboardBreakdown[] {
    const map = new Map<string, DashboardBreakdown>();
    for (const p of lines) {
      const cur = map.get(p.principalId) ?? {
        id: p.principalId,
        name: p.principalName,
        // Targets are set against people, not brands. Deriving a principal's
        // share of someone's target would be arithmetic nobody agreed to.
        target: null,
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
