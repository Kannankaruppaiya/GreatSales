/* Domain vocabulary + formatting — mirrors apps/web so screens speak the same
 * business language. Salesperson slice only. */
import type { Tone } from './theme';

// ---- money / date format (Indian market) --------------------------------
export const inr = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');
export const lakhs = (v: number) => {
  const n = Math.round(v);
  if (Math.abs(n) >= 1_00_00_000) return '₹' + (n / 1_00_00_000).toFixed(2) + 'Cr';
  if (Math.abs(n) >= 1_00_000) return '₹' + (n / 1_00_000).toFixed(1) + 'L';
  if (Math.abs(n) >= 1_000) return '₹' + (n / 1_000).toFixed(1) + 'K';
  return '₹' + n.toLocaleString('en-IN');
};
export const pct = (v: number | null, d = 0) =>
  v == null || !isFinite(v) ? '—' : v.toFixed(d) + '%';
export const shortDate = (iso?: string | null) => {
  if (!iso) return '—';
  const dt = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};
/** Days between iso and today (negative = future). */
export const agingDays = (iso?: string | null) => {
  if (!iso) return null;
  const dt = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(dt.getTime())) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.floor((t.getTime() - dt.getTime()) / 86_400_000);
};
export const initials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

/** Duration in ms → "2d 4h" / "5h 30m" / "45m" / "—". */
export const fmtDur = (ms: number | null) => {
  if (ms == null || !isFinite(ms)) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60), rm = mins % 60;
  if (hrs < 24) return hrs + 'h' + (rm ? ' ' + rm + 'm' : '');
  const days = Math.floor(hrs / 24), rh = hrs % 24;
  return days + 'd' + (rh ? ' ' + rh + 'h' : '');
};

// ---- enums --------------------------------------------------------------
export const DEAL_STAGES = [
  'New Enquiries',
  'Needs Analysis',
  'Trials & Sample Tests',
  'Proposals & Price Quote',
  'Negotiation / Oral Confirmation',
  'Closed Won',
  'Closed Lost',
  'No Requirement or Cold',
  'Trial Problem',
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const SO_STATUSES = [
  'Created',
  'Acknowledged',
  'Delivery Partner Assigned',
  'Delivered from Warehouse',
  'Delivered to Customer',
  'Customer Receipt Confirmed',
  'Cancelled',
] as const;
export type SoStatus = (typeof SO_STATUSES)[number];

export const PAY_ZONES = ['Green Zone', 'Yellow Zone', 'Red Zone', 'Blacklist', 'Unassigned'] as const;
export type PayZone = (typeof PAY_ZONES)[number];
export const TIERS = ['Platinum', 'Gold', 'Silver', 'Brass'] as const;
export type Tier = (typeof TIERS)[number];

export const PROJ_STATUSES = [
  'Projection Created', 'Follow-up Pending', 'Customer Interested', 'Waiting Approval',
  'PO Expected', 'PO Received', 'Order Placed', 'Partially Confirmed', 'Confirmed',
  'Completed', 'Deferred to Next Month', 'Lost', 'Cancelled',
] as const;

export const DELIVERY_MODES = ['Company Vehicle', 'Courier', 'Transport (LR)', 'Customer Pickup', 'Hand Delivery'] as const;
export const PAYMENT_TERMS = [
  'Immediate',
  '15 Days Credit',
  '30 Days Credit',
  '45 Days Credit',
  'Cash on Delivery',
  'Advance 50% + Balance Delivery',
  '100% Advance Payment',
] as const;
export const FU_MODES = ['Call', 'Visit', 'WhatsApp', 'Email'] as const;
export const CUST_TYPES = ['New', 'Existing'] as const;

export const INDUSTRY_TAXONOMY: Record<string, string[]> = {
  'Automotive & Auto Components': [
    'OEM Vehicle Assembly',
    'Tier-1 Engine & Transmission',
    'Tier-2 Stamping & Fasteners',
    'Auto Electricals & Electronics',
    'Brake Systems & Suspension',
    'Aftermarket & Spares',
  ],
  'General Engineering & Machining': [
    'CNC Machining & Turning',
    'VMC & Precision Job Work',
    'Tool Room & Die Making',
    'Fabrication & Structural Works',
    'Hydraulic & Pneumatic Systems',
    'Pumps, Valves & Actuators',
  ],
  'Foundry, Forging & Metallurgy': [
    'Die Casting (HPDC / LPDC)',
    'Grey & Ductile Iron Foundry',
    'Steel Forging & Extrusion',
    'Aluminium Smelting & Ingot',
    'Heat Treatment & Hardening',
  ],
  'Surface Treatment & Coating': [
    'Powder Coating & Electrostatic',
    'Electroplating (Zinc / Chrome / Nickel)',
    'Anodizing & Passivation',
    'Shot Blasting & Sand Blasting',
    'Phosphating & CED Coating',
    'Industrial Painting & Spray',
  ],
  'Plastics, Polymers & Rubber': [
    'Plastic Injection Moulding',
    'Blow Moulding & Extrusion',
    'Rubber Moulding & Tyre Spares',
    'Mould & Die Manufacturing',
  ],
  'Electrical, Electronics & Energy': [
    'Transformer & Switchgear',
    'Motor & Pump Assembly',
    'Cables, Wiring & Harness',
    'Solar & Renewable Equipment',
    'Control Panels & Automation',
  ],
  'Heavy Machinery, Infra & Construction': [
    'Earthmoving & Mining Spares',
    'Crane & Material Handling',
    'Boiler, Pressure Vessel & Process Equipment',
    'Pre-Engineered Building (PEB)',
  ],
  'Process & Packaging Industries': [
    'Pharmaceutical Machining',
    'Food & Dairy Processing Equipment',
    'Printing & Packaging Machinery',
    'Textile Machinery & Spares',
  ],
  'Other / Unclassified': [
    'Trading & Supply Agency',
    'Facility Maintenance & Services',
    'Miscellaneous Manufacturing',
  ],
};

export const INDUSTRIES = Object.keys(INDUSTRY_TAXONOMY);
export const AREAS = ['Ambattur', 'Guindy', 'Sriperumbudur', 'Oragadam', 'Irungattukottai', 'Hosur', 'Coimbatore', 'Ennore', 'Padi', 'Other'] as const;
export const PRINCIPALS = ['Shell Lubricants', 'Castrol', 'Fuchs', 'Gulf Oil', 'Valvoline'] as const;

export const MONTH_LABEL = 'Aug 2026';
export const MONTH = '2026-08';

// ---- aging helpers ------------------------------------------------------
export const agingBucket = (days: number | null) => {
  if (days == null) return '—';
  if (days <= 30) return '0-30d';
  if (days <= 60) return '31-60d';
  if (days <= 90) return '61-90d';
  if (days <= 120) return '91-120d';
  if (days <= 150) return '121-150d';
  return '150d+';
};

// ---- tone helpers -------------------------------------------------------
export const projTone = (s: string): Tone => {
  if (s === 'Confirmed' || s === 'Completed') return 'won';
  if (['Partially Confirmed', 'PO Expected', 'Waiting Approval', 'PO Received', 'Order Placed'].includes(s)) return 'hot';
  if (s === 'Lost' || s === 'Cancelled') return 'lost';
  return 'open';
};
export const dealTone = (s: string): Tone => {
  if (s === 'Closed Won') return 'won';
  if (['Closed Lost', 'No Requirement or Cold'].includes(s)) return 'lost';
  if (['Trial Problem', 'Negotiation / Oral Confirmation', 'Proposals & Price Quote'].includes(s)) return 'hot';
  return 'open';
};
export const soTone = (s: string): Tone => {
  if (s === 'Cancelled') return 'lost';
  if (s === 'Customer Receipt Confirmed') return 'won';
  if (s === 'Created') return 'open';
  return 'hot';
};
export const zoneTone = (z: string): Tone => {
  if (z === 'Green Zone') return 'won';
  if (z === 'Yellow Zone') return 'hot';
  if (z === 'Blacklist') return 'lost';
  if (z === 'Unassigned') return 'neutral';
  return 'lost';
};
export const tierTone = (t: string): Tone => {
  if (t === 'Platinum') return 'won';
  if (t === 'Gold') return 'hot';
  if (t === 'Silver') return 'open';
  return 'neutral';
};
export const probTone = (p: number): Tone =>
  p >= 80 ? 'won' : p >= 50 ? 'hot' : p >= 25 ? 'open' : 'lost';

// ---- types --------------------------------------------------------------
export interface Customer {
  id: string;
  name: string;
  tier: Tier;
  industry: string;
  area: string;
  contactName: string;
  phone: string;
  whatsapp?: string;
  sameAsMobile?: boolean;
  address?: string;
  paymentTerms?: string;
  payZone: PayZone;
  outstanding: number;
  division: string;
}
export interface Projection {
  id: string;
  customerId?: string;
  customerName: string;
  principal: string;
  product: string;
  projectedQty: number;
  achievedQty: number;
  price: number;
  probability: number;
  status: string;
  nextFollowUp: string | null;
}
export interface LeadProduct { name: string; value: number }
export interface Lead {
  id: string;
  name: string;
  tier: Tier;
  industry: string;
  subIndustry?: string;
  area: string;
  address?: string;
  contactName: string;
  phone: string;
  whatsapp?: string;
  sameAsMobile?: boolean;
  stage: DealStage;
  value: number;
  nextFollowUp: string | null;
  expClose: string | null;
  stageUpdatedAt: string;
}
export interface SalesOrder {
  id: string;
  code: string;
  customerName: string;
  productName?: string;
  status: SoStatus;
  value: number;
  expectedDelivery: string | null;
  isUrgent?: boolean;
  deliveryMode: string;
  shipTo: string;
}
export interface Payment {
  id: string;
  refNo: string;
  customerName: string;
  invoiceNo: string;
  amount: number;
  opening?: number;
  pending: number;
  received?: number | null;
  dueDate: string;
  date?: string;
  zone: PayZone;
  reason?: string;
  nextFollowUp: string | null;
  mail1?: string;
  mail2?: string;
  mail3?: string;
  mail4?: string;
}
export type FollowUpKind = 'projection' | 'lead' | 'payment';
export interface FollowUp {
  id: string;
  kind: FollowUpKind;
  targetId?: string;
  title: string;
  subtitle: string;
  dueDate: string;
  amount: number;
}
