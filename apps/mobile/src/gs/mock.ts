/* Deterministic salesperson mock data (UI-only). Owner = "Sankar Prasad".
 * Dates are offset from today so Follow-ups group into overdue/today/upcoming. */
import type {
  Customer, FollowUp, Lead, Payment, Projection, SalesOrder,
} from './domain';

export const ME = { name: 'Sankar Prasad', role: 'Salesperson', region: 'Chennai — LUB', id: 'u_sankar' };

const iso = (offsetDays: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

export const customers: Customer[] = [
  { id: 'c1', name: 'Ashok Leyland Ennore', tier: 'Platinum', industry: 'Automotive & Auto Components', area: 'Ennore', contactName: 'R. Karthik', phone: '9840012345', payZone: 'Green Zone', outstanding: 0, division: 'LUB' },
  { id: 'c2', name: 'Sundram Fasteners', tier: 'Gold', industry: 'Automotive & Auto Components', area: 'Ambattur', contactName: 'S. Meena', phone: '9840023456', payZone: 'Yellow Zone', outstanding: 142000, division: 'LUB' },
  { id: 'c3', name: 'Precision Turntech', tier: 'Silver', industry: 'General Engineering & Machining', area: 'Guindy', contactName: 'V. Rajan', phone: '9840034567', payZone: 'Red Zone', outstanding: 386500, division: 'WES' },
  { id: 'c4', name: 'Royal Foundry Works', tier: 'Gold', industry: 'Foundry, Forging & Metallurgy', area: 'Sriperumbudur', contactName: 'A. Fathima', phone: '9840045678', payZone: 'Green Zone', outstanding: 51000, division: 'LUB' },
  { id: 'c5', name: 'Kavin Plastics', tier: 'Brass', industry: 'Plastics, Polymers & Rubber', area: 'Oragadam', contactName: 'M. Suresh', phone: '9840056789', payZone: 'Yellow Zone', outstanding: 98750, division: 'WES' },
  { id: 'c6', name: 'Deccan Coaters', tier: 'Silver', industry: 'Surface Treatment & Coating', area: 'Irungattukottai', contactName: 'P. Latha', phone: '9840067890', payZone: 'Green Zone', outstanding: 0, division: 'LUB' },
];

export const projections: Projection[] = [
  { id: 'p1', customerName: 'Ashok Leyland Ennore', principal: 'Shell Lubricants', product: 'Tellus S2 M46 Hydraulic Oil', projectedQty: 40, achievedQty: 40, price: 8500, probability: 100, status: 'Confirmed', nextFollowUp: null },
  { id: 'p2', customerName: 'Sundram Fasteners', principal: 'Shell Lubricants', product: 'Omala S2 G220 Gear Oil', projectedQty: 30, achievedQty: 12, price: 9200, probability: 70, status: 'PO Expected', nextFollowUp: iso(-2) },
  { id: 'p3', customerName: 'Royal Foundry Works', principal: 'Fuchs', product: 'Renolin CLP 150', projectedQty: 25, achievedQty: 0, price: 7600, probability: 40, status: 'Customer Interested', nextFollowUp: iso(0) },
  { id: 'p4', customerName: 'Precision Turntech', principal: 'Castrol', product: 'Hysol MB 50 Coolant', projectedQty: 18, achievedQty: 6, price: 5400, probability: 55, status: 'Waiting Approval', nextFollowUp: iso(3) },
  { id: 'p5', customerName: 'Deccan Coaters', principal: 'Fuchs', product: 'Anticorit RP 4107', projectedQty: 12, achievedQty: 0, price: 6100, probability: 15, status: 'Projection Created', nextFollowUp: null },
  { id: 'p6', customerName: 'Kavin Plastics', principal: 'Castrol', product: 'Iloform PN 226', projectedQty: 20, achievedQty: 20, price: 4800, probability: 100, status: 'Completed', nextFollowUp: null },
];

export const leads: Lead[] = [
  { id: 'l1', name: 'TVS Sundram Clayton', tier: 'Platinum', industry: 'Automotive & Auto Components', area: 'Hosur', contactName: 'G. Prakash', phone: '9840101234', stage: 'Negotiation / Oral Confirmation', value: 480000, nextFollowUp: iso(0), expClose: iso(9), stageUpdatedAt: iso(-4) },
  { id: 'l2', name: 'Wheels India', tier: 'Gold', industry: 'Automotive & Auto Components', area: 'Sriperumbudur', contactName: 'K. Anitha', phone: '9840112345', stage: 'Proposals & Price Quote', value: 265000, nextFollowUp: iso(-1), expClose: iso(14), stageUpdatedAt: iso(-18) },
  { id: 'l3', name: 'Lucas TVS', tier: 'Gold', industry: 'Electrical, Electronics & Energy', area: 'Padi', contactName: 'B. Ramesh', phone: '9840123456', stage: 'Trials & Sample Tests', value: 190000, nextFollowUp: iso(2), expClose: iso(20), stageUpdatedAt: iso(-6) },
  { id: 'l4', name: 'Craftsman Automation', tier: 'Silver', industry: 'General Engineering & Machining', area: 'Coimbatore', contactName: 'D. Vimala', phone: '9840134567', stage: 'Needs Analysis', value: 120000, nextFollowUp: iso(1), expClose: iso(25), stageUpdatedAt: iso(-3) },
  { id: 'l5', name: 'Rane Brake Lining', tier: 'Platinum', industry: 'Automotive & Auto Components', area: 'Guindy', contactName: 'S. Nithya', phone: '9840145678', stage: 'New Enquiries', value: 95000, nextFollowUp: iso(4), expClose: iso(30), stageUpdatedAt: iso(-1) },
  { id: 'l6', name: 'Brakes India', tier: 'Gold', industry: 'Automotive & Auto Components', area: 'Sholinganallur', contactName: 'T. Kumar', phone: '9840156789', stage: 'Closed Won', value: 310000, nextFollowUp: null, expClose: iso(-2), stageUpdatedAt: iso(-2) },
];

export const orders: SalesOrder[] = [
  { id: 'o1', code: 'SO-2601', customerName: 'Ashok Leyland Ennore', status: 'Customer Receipt Confirmed', value: 340000, expectedDelivery: iso(-5), deliveryMode: 'Transport (LR)', shipTo: 'Ennore Plant Gate 2' },
  { id: 'o2', code: 'SO-2602', customerName: 'Sundram Fasteners', status: 'Delivered from Warehouse', value: 110400, expectedDelivery: iso(2), isUrgent: true, deliveryMode: 'Company Vehicle', shipTo: 'Ambattur Unit-1' },
  { id: 'o3', code: 'SO-2603', customerName: 'Royal Foundry Works', status: 'Acknowledged', value: 76000, expectedDelivery: iso(6), deliveryMode: 'Courier', shipTo: 'Sriperumbudur Stores' },
  { id: 'o4', code: 'SO-2604', customerName: 'Kavin Plastics', status: 'Created', value: 96000, expectedDelivery: iso(8), deliveryMode: 'Customer Pickup', shipTo: 'Oragadam' },
  { id: 'o5', code: 'SO-2605', customerName: 'Precision Turntech', status: 'Cancelled', value: 54000, expectedDelivery: null, deliveryMode: 'Hand Delivery', shipTo: 'Guindy' },
];

export const payments: Payment[] = [
  { id: 'pay1', refNo: 'PY-9001', customerName: 'Precision Turntech', invoiceNo: 'INV-4412', amount: 386500, pending: 386500, dueDate: iso(-22), zone: 'Red Zone', nextFollowUp: iso(-1) },
  { id: 'pay2', refNo: 'PY-9002', customerName: 'Sundram Fasteners', invoiceNo: 'INV-4433', amount: 142000, pending: 142000, dueDate: iso(-6), zone: 'Yellow Zone', nextFollowUp: iso(0) },
  { id: 'pay3', refNo: 'PY-9003', customerName: 'Kavin Plastics', invoiceNo: 'INV-4451', amount: 98750, pending: 60000, dueDate: iso(3), zone: 'Yellow Zone', nextFollowUp: iso(3) },
  { id: 'pay4', refNo: 'PY-9004', customerName: 'Royal Foundry Works', invoiceNo: 'INV-4460', amount: 51000, pending: 51000, dueDate: iso(9), zone: 'Green Zone', nextFollowUp: null },
];

export const followups: FollowUp[] = [
  { id: 'f1', kind: 'payment', title: 'Precision Turntech', subtitle: 'INV-4412 · ₹3.9L overdue 22d', dueDate: iso(-1), amount: 386500 },
  { id: 'f2', kind: 'projection', title: 'Sundram Fasteners', subtitle: 'Omala S2 G220 · PO Expected', dueDate: iso(-2), amount: 276000 },
  { id: 'f3', kind: 'lead', title: 'Wheels India', subtitle: 'Proposals & Price Quote', dueDate: iso(-1), amount: 265000 },
  { id: 'f4', kind: 'lead', title: 'TVS Sundram Clayton', subtitle: 'Oral Confirmation — close soon', dueDate: iso(0), amount: 480000 },
  { id: 'f5', kind: 'projection', title: 'Royal Foundry Works', subtitle: 'Renolin CLP 150 · Interested', dueDate: iso(0), amount: 190000 },
  { id: 'f6', kind: 'payment', title: 'Sundram Fasteners', subtitle: 'INV-4433 · ₹1.4L due', dueDate: iso(0), amount: 142000 },
  { id: 'f7', kind: 'lead', title: 'Craftsman Automation', subtitle: 'Needs Analysis', dueDate: iso(1), amount: 120000 },
  { id: 'f8', kind: 'lead', title: 'Lucas TVS', subtitle: 'Trials & Sample Tests', dueDate: iso(2), amount: 190000 },
  { id: 'f9', kind: 'projection', title: 'Precision Turntech', subtitle: 'Hysol MB 50 · Waiting Approval', dueDate: iso(3), amount: 97200 },
];

// ---- derived KPIs (salesperson-scoped) ----------------------------------
const openStages = (s: string) => !['Closed Lost', 'No Requirement or Cold'].includes(s);
export const kpis = () => {
  const recurringCommitted = projections.reduce((s, p) => s + p.projectedQty * p.price, 0);
  const recurringAchieved = projections.reduce((s, p) => s + p.achievedQty * p.price, 0);
  const newCommitted = leads.filter((l) => openStages(l.stage)).reduce((s, l) => s + l.value, 0);
  const newAchieved = leads.filter((l) => l.stage === 'Closed Won').reduce((s, l) => s + l.value, 0);
  const totalCommitted = recurringCommitted + newCommitted;
  const totalAchieved = recurringAchieved + newAchieved;
  return {
    recurringCommitted, recurringAchieved, newCommitted, newAchieved,
    totalCommitted, totalAchieved,
    achievementPct: totalCommitted > 0 ? (totalAchieved / totalCommitted) * 100 : null,
    weightedPipeline: projections.reduce((s, p) => s + p.projectedQty * p.price * (p.probability / 100), 0),
  };
};
