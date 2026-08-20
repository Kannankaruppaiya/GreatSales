import { DEAL_STAGES, type Role } from "@/data/constants";
import {
  customers,
  followups,
  leads,
  leadTotal,
  products,
  projections,
} from "@/data/mock";
import { agingDays } from "@/lib/format";

export interface Filters {
  role: Role;
  ownerId: string; // current user (matters for sales role)
  principalId: string; // "ALL" or id
  ownerFilter: string; // "ALL" or salesperson id (admin/mgmt)
}

function inPrincipal(productId: string, principalId: string) {
  if (principalId === "ALL") return true;
  return products.find((p) => p.id === productId)?.principalId === principalId;
}

export function scopedProjections(f: Filters) {
  return projections.filter((p) => {
    if (f.role === "sales" && p.ownerId !== f.ownerId) return false;
    if (f.role !== "sales" && f.ownerFilter !== "ALL" && p.ownerId !== f.ownerFilter)
      return false;
    if (!inPrincipal(p.productId, f.principalId)) return false;
    return true;
  });
}

export function scopedLeads(f: Filters) {
  return leads.filter((l) => {
    if (f.role === "sales" && l.ownerId !== f.ownerId) return false;
    if (f.role !== "sales" && f.ownerFilter !== "ALL" && l.ownerId !== f.ownerFilter)
      return false;
    if (
      f.principalId !== "ALL" &&
      !l.products.some((p) => p.principalId === f.principalId)
    )
      return false;
    return true;
  });
}

export interface Kpis {
  recurringCommitted: number;
  recurringAchieved: number;
  newCommitted: number;
  newAchieved: number;
  totalCommitted: number;
  totalAchieved: number;
  achievementPct: number | null;
  gapPct: number | null;
  pendingValue: number;
  projLines: number;
  activeLeads: number;
  fuDue: number;
  fuOverdue: number;
}

export function computeKpis(f: Filters): Kpis {
  const projs = scopedProjections(f);
  const recurringCommitted = projs.reduce((s, p) => s + p.projectedQty * p.price, 0);
  const recurringAchieved = projs.reduce((s, p) => s + p.achievedQty * p.price, 0);

  const lds = scopedLeads(f);
  const openLeads = lds.filter(
    (l) => !["Closed Lost", "No Requirement or Cold"].includes(l.stage),
  );
  const newCommitted = openLeads.reduce((s, l) => s + leadTotal(l), 0);
  const newAchieved = lds
    .filter((l) => l.stage === "Closed Won")
    .reduce((s, l) => s + leadTotal(l), 0);

  const totalCommitted = recurringCommitted + newCommitted;
  const totalAchieved = recurringAchieved + newAchieved;
  const achievementPct = totalCommitted > 0 ? (totalAchieved / totalCommitted) * 100 : null;

  const relevantFu = followups.filter(
    (fu: any) =>
      (f.role !== "sales" || fu.ownerId === f.ownerId) &&
      (f.role === "sales" || f.ownerFilter === "ALL" || fu.ownerId === f.ownerFilter),
  );
  let fuDue = 0;
  let fuOverdue = 0;
  for (const fu of relevantFu) {
    const d = agingDays(fu.dueDate);
    if (d == null) continue;
    if (d > 0) fuOverdue++;
    else if (d === 0) fuDue++;
  }

  return {
    recurringCommitted,
    recurringAchieved,
    newCommitted,
    newAchieved,
    totalCommitted,
    totalAchieved,
    achievementPct,
    gapPct: achievementPct == null ? null : 100 - achievementPct,
    pendingValue: Math.max(0, totalCommitted - totalAchieved),
    projLines: projs.length,
    activeLeads: openLeads.length,
    fuDue,
    fuOverdue,
  };
}

/** Committed vs achieved value per salesperson (for the dashboard bar chart). */
export function bySalesperson(f: Filters) {
  const map = new Map<string, { committed: number; achieved: number }>();
  const add = (owner: string, c: number, a: number) => {
    const cur = map.get(owner) ?? { committed: 0, achieved: 0 };
    cur.committed += c;
    cur.achieved += a;
    map.set(owner, cur);
  };
  for (const p of scopedProjections(f)) {
    add(p.ownerId, p.projectedQty * p.price, p.achievedQty * p.price);
  }
  for (const l of scopedLeads(f)) {
    const open = !["Closed Lost", "No Requirement or Cold"].includes(l.stage);
    add(l.ownerId, open ? leadTotal(l) : 0, l.stage === "Closed Won" ? leadTotal(l) : 0);
  }
  return [...map.entries()]
    .map(([ownerId, v]) => ({ ownerId, ...v }))
    .filter((d) => d.committed || d.achieved)
    .sort((a, b) => b.committed - a.committed);
}

/** Pipeline value by stage (funnel). */
export function pipelineByStage(f: Filters) {
  const lds = scopedLeads(f);
  return DEAL_STAGES.filter(
    (s) => !["Closed Lost", "No Requirement or Cold", "Trial Problem"].includes(s),
  ).map((stage) => {
    const rows = lds.filter((l) => l.stage === stage);
    return {
      stage,
      count: rows.length,
      value: rows.reduce((s, l) => s + leadTotal(l), 0),
    };
  });
}

/** Committed vs achieved by principal/brand. */
export function byPrincipal(f: Filters) {
  const map = new Map<string, { committed: number; achieved: number }>();
  for (const p of scopedProjections(f)) {
    const prod = products.find((x) => x.id === p.productId);
    const key = prod?.principalId ?? "other";
    const cur = map.get(key) ?? { committed: 0, achieved: 0 };
    cur.committed += p.projectedQty * p.price;
    cur.achieved += p.achievedQty * p.price;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([principalId, v]) => ({ principalId, ...v }))
    .sort((a, b) => b.committed - a.committed);
}

export const activeCustomerCount = customers.filter((c) => c.active).length;
