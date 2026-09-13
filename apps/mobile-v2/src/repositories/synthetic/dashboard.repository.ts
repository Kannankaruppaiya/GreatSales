import type { DashboardRepository } from '../interfaces';
import type { DashboardMetrics, Lead, ProjectionLine, FollowUp, Payment } from '../../domain/types';
import { canonicalState } from './canonical-state';
import { calculateDashboardMetrics, getTodayIso } from '../../domain/calculations';

export class SyntheticDashboardRepository implements DashboardRepository {
  async getMetrics(ownerId?: string): Promise<DashboardMetrics> {
    const user = canonicalState.currentUser;
    const effectiveOwnerId = ownerId || (user.role === 'sales' ? user.id : undefined);

    const projections = effectiveOwnerId
      ? canonicalState.projections.filter((p) => p.salespersonId === effectiveOwnerId)
      : canonicalState.projections;

    const leads = effectiveOwnerId
      ? canonicalState.leads.filter((l) => l.salespersonId === effectiveOwnerId)
      : canonicalState.leads;

    const followUps = effectiveOwnerId
      ? canonicalState.followups.filter((f) => f.salespersonId === effectiveOwnerId)
      : canonicalState.followups;

    const payments = effectiveOwnerId
      ? canonicalState.payments.filter((p) => p.salespersonId === effectiveOwnerId)
      : canonicalState.payments;

    return calculateDashboardMetrics(projections, leads, followUps, payments, 3000000);
  }

  async getOralConfirmationDeals(ownerId?: string): Promise<Lead[]> {
    const user = canonicalState.currentUser;
    const effectiveOwnerId = ownerId || (user.role === 'sales' ? user.id : undefined);

    return canonicalState.leads.filter((l) => {
      const matchOwner = effectiveOwnerId ? l.salespersonId === effectiveOwnerId : true;
      return matchOwner && l.stage === 'NegotiationOralConfirmation';
    });
  }

  async getTopProjections(ownerId?: string): Promise<ProjectionLine[]> {
    const user = canonicalState.currentUser;
    const effectiveOwnerId = ownerId || (user.role === 'sales' ? user.id : undefined);

    const list = canonicalState.projections.filter((p) => {
      const matchOwner = effectiveOwnerId ? p.salespersonId === effectiveOwnerId : true;
      return matchOwner && p.status !== 'Completed' && p.status !== 'Cancelled';
    });

    return list.sort((a, b) => (b.committedValue ?? 0) - (a.committedValue ?? 0)).slice(0, 5);
  }

  async getPriorityFollowUps(ownerId?: string): Promise<FollowUp[]> {
    const user = canonicalState.currentUser;
    const effectiveOwnerId = ownerId || (user.role === 'sales' ? user.id : undefined);
    const today = getTodayIso();

    const list = canonicalState.followups.filter((f) => {
      const matchOwner = effectiveOwnerId ? f.salespersonId === effectiveOwnerId : true;
      return matchOwner && !f.done && f.dueDate <= today;
    });

    return list.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)).slice(0, 5);
  }

  async getPaymentAlerts(ownerId?: string): Promise<Payment[]> {
    const user = canonicalState.currentUser;
    const effectiveOwnerId = ownerId || (user.role === 'sales' ? user.id : undefined);

    const list = canonicalState.payments.filter((p) => {
      const matchOwner = effectiveOwnerId ? p.salespersonId === effectiveOwnerId : true;
      const pendingVal = p.pending ?? (p.amount - (p.received ?? 0));
      const isRed = p.payZone === 'RedZone' || (p.paymentZone as string) === 'Red' || (p.paymentZone as string) === 'RedZone';
      return matchOwner && isRed && pendingVal > 0;
    });

    return list.sort((a, b) => {
      const pendingB = b.pending ?? (b.amount - (b.received ?? 0));
      const pendingA = a.pending ?? (a.amount - (a.received ?? 0));
      return pendingB - pendingA;
    }).slice(0, 3);
  }
}

export const syntheticDashboardRepository = new SyntheticDashboardRepository();
