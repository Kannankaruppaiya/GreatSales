import type { FollowUp, Payment, DashboardFollowUp, TaxModeValue } from '../types';

export function getTodayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function calculateAgingDays(iso: string | null | undefined): number {
  if (!iso) return 0;
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d.getTime())) return 0;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((t.getTime() - d.getTime()) / 86_400_000));
}

export function getFollowUpCategory(
  dueDate: string,
  done: boolean,
): 'completed' | 'overdue' | 'today' | 'upcoming' {
  if (done) return 'completed';
  const today = getTodayIso();
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  return 'upcoming';
}

/**
 * Line totals for an order being composed on screen, before it is posted.
 *
 * The API computes `lineTotal` and the order total itself; this exists only so
 * the form can show a running figure while the user is still typing. Fields are
 * `qty` and `price` because that is what OrderItemRow carries - the previous
 * `item.quantity ?? item.qty` / `item.rate ?? item.price` chains were guessing
 * between shapes the fixtures might produce, and the wire has exactly one.
 */
export function calculateOrderTotals(
  items: Array<{ qty: number; price: number }>,
  taxMode: TaxModeValue = 'Percentage',
  taxRate: number | null = 18,
  customTaxAmount: number | null = 0,
): { subtotal: number; taxAmount: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  let taxAmount = 0;

  if (taxMode === 'Percentage' && taxRate != null) {
    taxAmount = Math.round(subtotal * (taxRate / 100));
  } else if (taxMode === 'Amount' && customTaxAmount != null) {
    taxAmount = customTaxAmount;
  }

  return { subtotal, taxAmount, tax: taxAmount, total: subtotal + taxAmount };
}

/*
 * calculateDashboardMetrics used to live here. It summed committed and achieved
 * value over arrays of projections and leads, counted due and overdue
 * follow-ups, and divided by a `monthlyTarget = 3000000` written into its own
 * signature.
 *
 * It is gone because GET /dashboard already returns every one of those numbers
 * in `kpis`, computed over the whole tenant with the real SalesTarget rows. The
 * dashboard controller says why it exists: "One request replaces what the
 * console previously assembled by paging every lead in the tenant and reducing
 * them in the browser." The web console removed this calculation; this app had
 * reintroduced it.
 *
 * Client-side it could not have been right in any case. List endpoints are
 * cursor paginated at 20 rows, so summing what the app holds sums the first
 * page - a tenant with 4,000 leads would have reported the total of twenty of
 * them, confidently and to the rupee.
 */

export interface RankedPriorityItem {
  type: 'payment' | 'followup';
  id: string;
  urgencyScore: number;
  /** Nullable because PaymentRow's are: an invoice may carry neither. */
  customerName: string | null;
  title: string;
  amount: number | null;
  dueDate: string | null;
  daysOverdue: number;
  isRedZone: boolean;
  raw: Payment | FollowUp | DashboardFollowUp;
}

/**
 * Merges outstanding payments and open follow-ups into one list, most urgent
 * first, for the actions screens (02B).
 *
 * This ranks the rows it is GIVEN. Feed it the dashboard's capped lists, which
 * the server already selected as the most overdue, rather than a page of a list
 * endpoint - otherwise it ranks an arbitrary twenty rows.
 *
 * Ranking uses days overdue and amount, and nothing else. The previous version
 * weighted follow-ups by `f.priority` being High, Medium or Low: FollowUpRow
 * has no priority field and the API has no such concept, so that branch was
 * scoring a value only the fixtures ever produced. If follow-up priority is
 * wanted, it is a column on the API first.
 *
 * Scores are BANDED, and each band's within-band term is clamped so it cannot
 * reach the next one:
 *
 *   1000-1199  red-zone payment      (red account, or a bill over 60 days)
 *    800- 999  overdue follow-up
 *    500       follow-up due today
 *    300- 499  other outstanding payment
 *
 * The clamp is the point. Without it `800 + daysOverdue * 10` is unbounded, so
 * a follow-up left open long enough outranks every red-zone invoice no matter
 * how large - a forgotten courtesy call above a 1.1 crore debt. Within a band
 * the older and larger row still sorts first.
 */
const BAND = 199;
export function calculatePriorityItems(
  payments: Payment[],
  followUps: Array<FollowUp | DashboardFollowUp>,
): RankedPriorityItem[] {
  const items: RankedPriorityItem[] = [];
  const today = getTodayIso();

  for (const p of payments) {
    if (p.pending <= 0) continue;

    const agingDays = p.agingDays ?? 0;
    // payZone is the API's enum; a red account or a bill older than 60 days.
    const isRed = p.payZone === 'RedZone' || agingDays > 60;

    items.push({
      type: 'payment',
      id: p.id,
      urgencyScore: isRed
        ? 1000 + Math.min(BAND, agingDays * 2 + Math.floor(p.pending / 100_000))
        : 300 + Math.min(BAND, agingDays),
      customerName: p.customerName,
      title: p.invoiceNo ? `Invoice ${p.invoiceNo}` : 'Invoice',
      amount: p.pending,
      dueDate: p.dueDate,
      daysOverdue: agingDays,
      isRedZone: isRed,
      raw: p,
    });
  }

  for (const f of followUps) {
    // DashboardFollowUp rows are open by construction; FollowUpRow carries done.
    if ('done' in f && f.done) continue;

    const isOverdue = f.dueDate < today;
    const isToday = f.dueDate === today;
    if (!isOverdue && !isToday) continue;

    // The dashboard computes daysOverdue server-side; a list row has not.
    const daysOverdue =
      'daysOverdue' in f && f.daysOverdue != null
        ? f.daysOverdue
        : isOverdue
          ? calculateAgingDays(f.dueDate)
          : 0;

    items.push({
      type: 'followup',
      id: f.id,
      urgencyScore: isOverdue ? 800 + Math.min(BAND, daysOverdue * 10) : 500,
      // Neither row carries a customer name; the entity it hangs off does.
      customerName: f.subtitle ?? f.title ?? '',
      title: f.title ?? `${f.entityType} follow-up`,
      amount: f.amount,
      dueDate: f.dueDate,
      daysOverdue,
      isRedZone: false,
      raw: f,
    });
  }

  return items.sort((a, b) => b.urgencyScore - a.urgencyScore);
}
