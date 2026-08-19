/* Lightweight reactive in-app store (no deps). Seeded from mock data; mutations
 * persist across navigation for the running session. useSyncExternalStore based.
 * Swap the persist hooks for AsyncStorage / API later. */
import { useSyncExternalStore } from 'react';
import {
  customers as seedCustomers, projections as seedProjections, leads as seedLeads,
  orders as seedOrders, payments as seedPayments, followups as seedFollowups, ME,
} from './mock';
import type {
  Customer, Projection, Lead, SalesOrder, Payment, FollowUp, DealStage, SoStatus,
} from './domain';

export interface Remark { text: string; at: string; by: string }
export interface FuLog { date: string; mode: string; prob: number | null; notes: string; next: string | null }
export interface OrderStep { label: string; at: string | null; by?: string | null }

export interface Mapping { principal: string; product: string; price: number }
export interface LeadX extends Lead { remarks: Remark[]; products?: { name: string; value: number }[] }
export interface ProjectionX extends Projection { remarks: Remark[]; fus: FuLog[]; expClose?: string | null }
export interface OrderX extends SalesOrder { timeline: OrderStep[]; createdBy: string; cancelReason?: string | null; partner?: string | null }
export interface PaymentX extends Payment {
  remarks: Remark[];
  mails: number;
}
export interface CustomerX extends Customer { mappings?: Mapping[] }

interface State {
  customers: CustomerX[];
  projections: ProjectionX[];
  leads: LeadX[];
  orders: OrderX[];
  payments: PaymentX[];
  followups: FollowUp[];
}

const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

const SO_FLOW: SoStatus[] = [
  'Created', 'Acknowledged', 'Delivery Partner Assigned',
  'Delivered from Warehouse', 'Delivered to Customer', 'Customer Receipt Confirmed',
];

function seedTimeline(status: SoStatus): OrderStep[] {
  const labels = ['Order issued', 'Acknowledged', 'Delivery partner assigned', 'Delivered from warehouse', 'Delivered to customer', 'Customer receipt confirmed'];
  const idx = SO_FLOW.indexOf(status);
  return labels.map((label, i) => ({ label, at: i <= idx ? nowISO() : null }));
}

let state: State = {
  customers: seedCustomers.map((c) => ({
    ...c,
    paymentTerms: c.paymentTerms || '30 Days Credit',
    whatsapp: c.whatsapp || c.phone,
    sameAsMobile: c.sameAsMobile ?? true,
    address: c.address || `${c.area}, Chennai`,
    mappings: [
      { principal: 'Shell Lubricants', product: 'Tellus S2 MX 68', price: 185 },
    ],
  })),
  projections: seedProjections.map((p) => ({ ...p, remarks: [], fus: [], expClose: null })),
  leads: seedLeads.map((l) => ({
    ...l,
    remarks: [],
    subIndustry: l.subIndustry || 'OEM Vehicle Assembly',
    whatsapp: l.whatsapp || l.phone,
    sameAsMobile: l.sameAsMobile ?? true,
    address: l.address || `${l.area}, Industrial Estate`,
  })),
  orders: seedOrders.map((o) => ({ ...o, createdBy: ME.name, timeline: seedTimeline(o.status), cancelReason: null, partner: null })),
  payments: seedPayments.map((p) => ({
    ...p,
    remarks: [],
    mails: 0,
    mail1: p.mail1 || 'No',
    mail2: p.mail2 || 'No',
    mail3: p.mail3 || 'No',
    mail4: p.mail4 || 'No',
    reason: p.reason || '',
    opening: p.opening ?? p.amount,
    received: p.received ?? null,
    date: p.date || p.dueDate,
  })),
  followups: seedFollowups.map((f) => ({ ...f })),
};

const listeners = new Set<() => void>();
function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}
export const getState = () => state;

let seq = { c: 900, l: 900, o: 2699, p: 900, prj: 900 };

// ---- actions -------------------------------------------------------------
export const actions = {
  // Leads
  addLead(input: Omit<LeadX, 'id' | 'remarks' | 'stageUpdatedAt'>) {
    const id = 'l' + ++seq.l;
    state.leads = [{ ...input, id, remarks: [], stageUpdatedAt: today() }, ...state.leads];
    emit();
    return id;
  },
  moveLeadStage(id: string, stage: DealStage) {
    state.leads = state.leads.map((l) => (l.id === id ? { ...l, stage, stageUpdatedAt: today() } : l));
    emit();
  },
  updateLead(id: string, patch: Partial<LeadX>) {
    state.leads = state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l));
    emit();
  },
  addLeadRemark(id: string, text: string) {
    state.leads = state.leads.map((l) => (l.id === id ? { ...l, remarks: [{ text, at: nowISO(), by: ME.name }, ...l.remarks] } : l));
    emit();
  },
  // Customers
  addCustomer(input: Omit<CustomerX, 'id'>) {
    const id = 'c' + ++seq.c;
    state.customers = [{ ...input, id }, ...state.customers];
    emit();
    return id;
  },
  updateCustomer(id: string, patch: Partial<CustomerX>) {
    state.customers = state.customers.map((c) => (c.id === id ? { ...c, ...patch } : c));
    emit();
  },
  addCustomerMapping(customerId: string, mapping: Mapping) {
    state.customers = state.customers.map((c) => (c.id === customerId ? { ...c, mappings: [...(c.mappings || []), mapping] } : c));
    // also create projection line
    const cust = state.customers.find((c) => c.id === customerId);
    if (cust) {
      const prjId = 'p' + ++seq.prj;
      state.projections = [
        {
          id: prjId,
          customerId,
          customerName: cust.name,
          principal: mapping.principal,
          product: mapping.product,
          price: mapping.price,
          projectedQty: 0,
          achievedQty: 0,
          probability: 20,
          status: 'Projection Created',
          nextFollowUp: null,
          expClose: null,
          remarks: [],
          fus: [],
        },
        ...state.projections,
      ];
    }
    emit();
  },
  // Projections
  updateProjection(id: string, patch: Partial<ProjectionX>) {
    state.projections = state.projections.map((p) => (p.id === id ? { ...p, ...patch } : p));
    emit();
  },
  logProjectionFollowUp(id: string, fu: FuLog) {
    state.projections = state.projections.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p, fus: [fu, ...p.fus],
        probability: fu.prob != null ? fu.prob : p.probability,
        nextFollowUp: fu.next ?? p.nextFollowUp,
      };
    });
    emit();
  },
  addProjectionRemark(id: string, text: string) {
    state.projections = state.projections.map((p) => (p.id === id ? { ...p, remarks: [{ text, at: nowISO(), by: ME.name }, ...p.remarks] } : p));
    emit();
  },
  // Orders
  createOrder(input: Omit<OrderX, 'id' | 'code' | 'timeline' | 'createdBy' | 'status'>) {
    const id = 'SO-' + ++seq.o;
    const order: OrderX = { ...input, id, code: id, status: 'Created', createdBy: ME.name, timeline: seedTimeline('Created'), cancelReason: null, partner: null };
    state.orders = [order, ...state.orders];
    emit();
    return id;
  },
  advanceOrder(id: string, payload?: { partner?: string }) {
    state.orders = state.orders.map((o) => {
      if (o.id !== id || o.status === 'Cancelled') return o;
      const idx = SO_FLOW.indexOf(o.status);
      if (idx < 0 || idx >= SO_FLOW.length - 1) return o;
      const next = SO_FLOW[idx + 1];
      const timeline = o.timeline.map((t, i) => (i === idx + 1 ? { ...t, at: nowISO(), by: ME.name } : t));
      return { ...o, status: next, timeline, partner: payload?.partner ?? o.partner };
    });
    emit();
  },
  cancelOrder(id: string, reason: string) {
    state.orders = state.orders.map((o) => (o.id === id ? { ...o, status: 'Cancelled' as SoStatus, cancelReason: reason } : o));
    emit();
  },
  // Payments
  addPayment(input: Omit<PaymentX, 'id' | 'remarks'>) {
    const id = 'pay' + ++seq.p;
    state.payments = [
      {
        ...input,
        id,
        remarks: [],
        mails: 0,
        mail1: input.mail1 || 'No',
        mail2: input.mail2 || 'No',
        mail3: input.mail3 || 'No',
        mail4: input.mail4 || 'No',
        reason: input.reason || '',
      },
      ...state.payments,
    ];
    emit();
    return id;
  },
  addPaymentRemark(id: string, text: string) {
    state.payments = state.payments.map((p) => (p.id === id ? { ...p, remarks: [{ text, at: nowISO(), by: ME.name }, ...p.remarks] } : p));
    emit();
  },
  updatePayment(id: string, patch: Partial<PaymentX>) {
    state.payments = state.payments.map((p) => (p.id === id ? { ...p, ...patch } : p));
    emit();
  },
  togglePaymentMail(id: string, key: 'mail1' | 'mail2' | 'mail3' | 'mail4') {
    state.payments = state.payments.map((p) => {
      if (p.id !== id) return p;
      const current = p[key] === 'Yes';
      const newVal = current ? 'No' : 'Yes';
      const mailsCount = [key === 'mail1' ? newVal : p.mail1, key === 'mail2' ? newVal : p.mail2, key === 'mail3' ? newVal : p.mail3, key === 'mail4' ? newVal : p.mail4].filter((m) => m === 'Yes').length;
      return { ...p, [key]: newVal, mails: mailsCount };
    });
    emit();
  },
  sendPaymentMail(id: string) {
    state.payments = state.payments.map((p) => {
      if (p.id !== id) return p;
      const m = Math.min(4, p.mails + 1);
      return {
        ...p,
        mails: m,
        mail1: m >= 1 ? 'Yes' : p.mail1,
        mail2: m >= 2 ? 'Yes' : p.mail2,
        mail3: m >= 3 ? 'Yes' : p.mail3,
        mail4: m >= 4 ? 'Yes' : p.mail4,
      };
    });
    emit();
  },
  // Follow-ups
  markFollowUpDone(id: string) {
    state.followups = state.followups.filter((f) => f.id !== id);
    emit();
  },
  snoozeFollowUp(id: string, days: number) {
    state.followups = state.followups.map((f) => {
      if (f.id !== id) return f;
      const d = new Date(f.dueDate);
      d.setDate(d.getDate() + days);
      return { ...f, dueDate: d.toISOString().slice(0, 10) };
    });
    emit();
  },
  addFollowUp(input: Omit<FollowUp, 'id'>) {
    const id = 'fu' + Date.now();
    state.followups = [{ ...input, id }, ...state.followups];
    emit();
  },
};

export { SO_FLOW };
