import type {
  ProjectionLine,
  Lead,
  FollowUp,
  Payment,
  DashboardMetrics,
  OrderItem,
  TaxModeValue,
} from '../types';

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

export function calculateOrderTotals(
  items: Array<{ qty?: number; price?: number; quantity?: number; rate?: number }>,
  taxMode: TaxModeValue = 'Percentage',
  taxRate: number | null = 18,
  customTaxAmount: number | null = 0,
): { subtotal: number; taxAmount: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => {
    const q = item.quantity ?? item.qty ?? 0;
    const p = item.rate ?? item.price ?? 0;
    return sum + q * p;
  }, 0);
  let taxAmount = 0;

  if (taxMode === 'Percentage' && taxRate != null) {
    taxAmount = Math.round(subtotal * (taxRate / 100));
  } else if (taxMode === 'Amount' && customTaxAmount != null) {
    taxAmount = customTaxAmount;
  }

  return {
    subtotal,
    taxAmount,
    tax: taxAmount,
    total: subtotal + taxAmount,
  };
}

export function calculateDashboardMetrics(
  projections: ProjectionLine[],
  leads: Lead[],
  followUps: FollowUp[],
  payments: Payment[],
  monthlyTarget = 3000000,
): DashboardMetrics {
  const recurringCommitted = projections.reduce((sum, p) => {
    const val = p.committedValue ?? ((p.projectedQuantity ?? p.projectedQty ?? 0) * (p.rate ?? p.effectivePrice ?? p.basePrice ?? 0));
    return sum + val;
  }, 0);
  const recurringAchieved = projections.reduce((sum, p) => {
    const val = p.achievedValue ?? ((p.achievedQuantity ?? p.achievedQty ?? 0) * (p.rate ?? p.effectivePrice ?? p.basePrice ?? 0));
    return sum + val;
  }, 0);
  const recurringPct =
    recurringCommitted > 0 ? Math.round((recurringAchieved / recurringCommitted) * 100) : 0;

  const activeLeads = leads.filter(
    (l) => !['ClosedLost', 'NoRequirementOrCold', 'TrialProblem'].includes(l.stage),
  );
  const newSalesCommitted = activeLeads.reduce((sum, l) => sum + (l.totalValue ?? l.value ?? 0), 0);
  const wonLeads = leads.filter((l) => l.stage === 'ClosedWon' || (l.stage as string) === 'OrderClosedWon');
  const newSalesAchieved = wonLeads.reduce((sum, l) => sum + (l.totalValue ?? l.value ?? 0), 0);

  const totalCommitted = recurringCommitted + newSalesCommitted;
  const totalAchieved = recurringAchieved + newSalesAchieved;
  const totalPct = totalCommitted > 0 ? Math.round((totalAchieved / totalCommitted) * 100) : 0;

  const today = getTodayIso();
  const followUpsDue = followUps.filter((f) => !f.done && f.dueDate === today).length;
  const followUpsOverdue = followUps.filter((f) => !f.done && f.dueDate < today).length;

  const target = monthlyTarget;
  const targetPct = target > 0 ? Math.round((totalAchieved / target) * 100) : 0;

  const pendingPaymentsTotal = payments.reduce((sum, p) => sum + (p.pending ?? (p.amount - (p.received ?? 0))), 0);
  const redZonePaymentsCount = payments.filter((p) => {
    const isRed = p.payZone === 'RedZone' || (p.paymentZone as string) === 'Red' || (p.paymentZone as string) === 'RedZone';
    const pendingVal = p.pending ?? (p.amount - (p.received ?? 0));
    return isRed && pendingVal > 0;
  }).length;

  return {
    recurringCommitted,
    recurringAchieved,
    recurringPct,
    newSalesCommitted,
    newSalesAchieved,
    totalCommitted,
    totalAchieved,
    totalPct,
    achievementPercentage: totalPct,
    followUpsDue,
    followUpsOverdue,
    target,
    targetPct,
    remainingGap: Math.max(0, totalCommitted - totalAchieved),
    pendingPaymentsTotal,
    redZonePaymentsCount,
  };
}

export type RankedPriorityItem =
  | {
      type: 'payment';
      id: string;
      raw: Payment;
      urgencyScore: number;
      customerName: string;
      title: string;
      amount: number;
      dueDate: string;
      agingDays: number;
      isRedZone: boolean;
      reminderCount: number;
    }
  | {
      type: 'followup';
      id: string;
      raw: FollowUp;
      urgencyScore: number;
      customerName: string;
      title: string;
      amount?: number | null;
      dueDate: string;
      isOverdue: boolean;
      priority: 'High' | 'Medium' | 'Low';
    };

export function calculatePriorityItems(
  payments: Payment[],
  followUps: FollowUp[],
): RankedPriorityItem[] {
  const items: RankedPriorityItem[] = [];
  const today = getTodayIso();

  for (const p of payments) {
    const pendingAmount = p.pending ?? (p.amount - (p.received ?? 0));
    if (pendingAmount <= 0) continue;

    const isRed =
      p.payZone === 'RedZone' ||
      (p.paymentZone as string) === 'Red' ||
      (p.paymentZone as string) === 'RedZone' ||
      p.agingDays > 60;

    const reminderCount = [p.mail1, p.mail2, p.mail3, p.mail4].filter(Boolean).length;
    const urgencyScore = isRed
      ? 1000 + (p.agingDays || 0) * 2 + Math.min(100, Math.floor(pendingAmount / 100000))
      : 300 + (p.agingDays || 0);

    items.push({
      type: 'payment',
      id: p.id,
      raw: p,
      urgencyScore,
      customerName: p.customerName || 'Customer',
      title: `Invoice ${p.invoiceCode ?? p.invoiceNo ?? ''}`.trim(),
      amount: pendingAmount,
      dueDate: p.dueDate,
      agingDays: p.agingDays || 0,
      isRedZone: isRed,
      reminderCount,
    });
  }

  for (const f of followUps) {
    if (f.done) continue;
    const isOverdue = f.dueDate < today;
    const isToday = f.dueDate === today;
    if (!isOverdue && !isToday && f.priority !== 'High') continue;

    const prioWeight = f.priority === 'High' ? 120 : f.priority === 'Medium' ? 60 : 20;
    const daysOverdue = isOverdue ? calculateAgingDays(f.dueDate) : 0;

    const urgencyScore = isOverdue
      ? 800 + daysOverdue * 10 + prioWeight
      : 500 + prioWeight;

    items.push({
      type: 'followup',
      id: f.id,
      raw: f,
      urgencyScore,
      customerName: f.customerName || f.title || 'Customer',
      title: f.title,
      amount: f.amount,
      dueDate: f.dueDate,
      isOverdue,
      priority: f.priority || 'Medium',
    });
  }

  return items.sort((a, b) => b.urgencyScore - a.urgencyScore);
}
