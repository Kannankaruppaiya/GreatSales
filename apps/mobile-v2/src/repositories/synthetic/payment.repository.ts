import type { PaymentRepository } from '../interfaces';
import type { Payment } from '../../domain/types';
import { canonicalState } from './canonical-state';

export class SyntheticPaymentRepository implements PaymentRepository {
  async list(params?: { search?: string; status?: string; payZone?: string }): Promise<Payment[]> {
    let result = [...canonicalState.payments];

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.customerName.toLowerCase().includes(q) ||
          (p.invoiceNo?.toLowerCase().includes(q) ?? false) ||
          (p.invoiceCode?.toLowerCase().includes(q) ?? false) ||
          (p.refNo?.toLowerCase().includes(q) ?? false),
      );
    }

    if (params?.status && params.status !== 'ALL') {
      result = result.filter((p) => p.status === params.status);
    }

    if (params?.payZone && params.payZone !== 'ALL') {
      result = result.filter((p) => p.payZone === params.payZone);
    }

    return result;
  }

  async getById(id: string): Promise<Payment | null> {
    const payment = canonicalState.payments.find((p) => p.id === id);
    return payment ? { ...payment } : null;
  }

  async recordPayment(id: string, amount: number, note?: string): Promise<Payment> {
    const index = canonicalState.payments.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Payment record with ID ${id} not found.`);
    }

    const p = canonicalState.payments[index];
    const newReceived = (p.received ?? 0) + amount;
    const newPending = Math.max(0, p.amount - newReceived);
    const newStatus = newPending === 0 ? 'Paid' : 'PartiallyPaid';
    const now = new Date().toISOString();

    const updatedFollowups = [
      ...(p.followups ?? []),
      {
        id: `pf_${Date.now()}`,
        date: now.slice(0, 10),
        note: `Payment recorded: ₹${amount.toLocaleString('en-IN')}${note ? ` (${note})` : ''}`,
        nextFollowupDate: newPending > 0 ? (p.nextFollowUp ?? null) : null,
      },
    ];

    const updated: Payment = {
      ...p,
      received: newReceived,
      pending: newPending,
      status: newStatus,
      followups: updatedFollowups,
      updatedAt: now,
    };
    canonicalState.payments[index] = updated;

    // Cross-module update on customer outstanding
    const customer = canonicalState.customers.find((c) => c.id === p.customerId);
    if (customer) {
      customer.outstanding = Math.max(0, customer.outstanding - amount);
    }

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Payment',
      entityId: id,
      customerId: p.customerId,
      customerName: p.customerName,
      type: 'payment',
      description: `Payment of ₹${amount.toLocaleString('en-IN')} received for invoice ${p.invoiceNo}. Balance: ₹${newPending.toLocaleString('en-IN')}.`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...updated };
  }

  async sendReminder(id: string, stage: 'mail1' | 'mail2' | 'mail3' | 'mail4'): Promise<Payment> {
    const index = canonicalState.payments.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Payment record with ID ${id} not found.`);
    }

    const p = canonicalState.payments[index];
    const now = new Date().toISOString();

    const updated: Payment = {
      ...p,
      [stage]: true,
      [`${stage}At`]: now,
      updatedAt: now,
    };
    canonicalState.payments[index] = updated;

    // Cross-module activity log
    const stageLabels = {
      mail1: '1st Reminder (Soft Reminder)',
      mail2: '2nd Reminder (Overdue Notice)',
      mail3: '3rd Reminder (Urgent Final Call)',
      mail4: '4th Reminder (Legal Warning)',
    };
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Payment',
      entityId: id,
      customerId: p.customerId,
      customerName: p.customerName,
      type: 'whatsapp',
      description: `Sent ${stageLabels[stage]} for overdue invoice ${p.invoiceNo ?? p.invoiceCode} (₹${(p.pending ?? (p.amount - (p.received ?? 0))).toLocaleString('en-IN')})`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...updated };
  }

  async addRemark(id: string, note: string): Promise<void> {
    const p = canonicalState.payments.find((item) => item.id === id);
    if (!p) return;

    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Payment',
      entityId: id,
      customerId: p.customerId,
      customerName: p.customerName,
      type: 'remark',
      description: `Payment note: ${note}`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: new Date().toISOString(),
    });
  }
}

export const syntheticPaymentRepository = new SyntheticPaymentRepository();
