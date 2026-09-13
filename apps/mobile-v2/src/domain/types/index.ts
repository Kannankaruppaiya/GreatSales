/**
 * GreatSales Mobile Domain Types.
 * Strictly aligned with @greatsales/shared and NestJS backend contracts.
 */

export type Role = 'super_admin' | 'admin' | 'mgmt' | 'sales';

export const DIVISION_VALUES = ['LUB', 'WES'] as const;
export type DivisionValue = (typeof DIVISION_VALUES)[number];

export const CUSTOMER_CATEGORY_VALUES = ['Platinum', 'Gold', 'Silver', 'Brass'] as const;
export type CustomerCategoryValue = (typeof CUSTOMER_CATEGORY_VALUES)[number];

export const CUSTOMER_TYPE_VALUES = ['Existing', 'New'] as const;
export type CustomerTypeValue = (typeof CUSTOMER_TYPE_VALUES)[number];

export const PAYMENT_TERMS_VALUES = [
  'Immediate',
  'Credit15',
  'Credit30',
  'Credit45',
  'CashOnDelivery',
  'Advance50Balance',
  'AdvancePayment',
] as const;
export type PaymentTermsValue = (typeof PAYMENT_TERMS_VALUES)[number];

export const PAY_ZONE_VALUES = ['RedZone', 'YellowZone', 'GreenZone', 'Blacklist', 'Green', 'Yellow', 'Red'] as const;
export type PayZoneValue = (typeof PAY_ZONE_VALUES)[number];
export type PaymentZoneValue = PayZoneValue;

export const DEAL_STAGE_VALUES = [
  'NewEnquiries',
  'NeedsAnalysis',
  'TrialsAndSampleTests',
  'ProposalsAndPriceQuote',
  'NegotiationOralConfirmation',
  'ClosedWon',
  'OrderClosedWon',
  'ClosedLost',
  'NoRequirementOrCold',
  'TrialProblem',
  'Lead',
] as const;
export type DealStageValue = (typeof DEAL_STAGE_VALUES)[number];

export const PROJ_STATUS_VALUES = [
  'ProjectionCreated',
  'FollowUpPending',
  'CustomerInterested',
  'WaitingApproval',
  'POExpected',
  'POReceived',
  'OrderPlaced',
  'PartiallyConfirmed',
  'Confirmed',
  'Completed',
  'DeferredToNextMonth',
  'Lost',
  'Cancelled',
  'InProgress',
  'NeedsAttention',
] as const;
export type ProjStatusValue = (typeof PROJ_STATUS_VALUES)[number];

export const ORDER_STATUS_VALUES = [
  'Created',
  'Acknowledged',
  'DeliveryPartnerAssigned',
  'Dispatched',
  'DeliveredFromWarehouse',
  'DeliveredToCustomer',
  'CustomerReceiptConfirmed',
  'Cancelled',
] as const;
export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];

export const TAX_MODE_VALUES = ['None', 'Percentage', 'Amount'] as const;
export type TaxModeValue = (typeof TAX_MODE_VALUES)[number];

export const DELIVERY_MODE_VALUES = [
  'TransportLR',
  'Courier',
  'CompanyVehicle',
  'CustomerPickup',
  'HandDelivery',
] as const;
export type DeliveryModeValue = (typeof DELIVERY_MODE_VALUES)[number];

export const PAYMENT_STATUS_VALUES = ['Pending', 'PartiallyPaid', 'Paid', 'Overdue'] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUS_VALUES)[number];

export const ENTITY_TYPE_VALUES = [
  'Customer',
  'Lead',
  'Order',
  'Payment',
  'Projection',
  'FollowUp',
  'customer',
  'lead',
  'order',
  'payment',
  'projection',
  'followup',
] as const;
export type EntityTypeValue = (typeof ENTITY_TYPE_VALUES)[number];

// Human Labels & Semantic Mappings
export const DEAL_STAGE_LABELS: Record<string, string> = {
  NewEnquiries: 'New Enquiries',
  NeedsAnalysis: 'Needs Analysis',
  TrialsAndSampleTests: 'Trials & Sample Tests',
  ProposalsAndPriceQuote: 'Proposals & Price Quote',
  NegotiationOralConfirmation: 'Negotiation / Oral Confirmation',
  ClosedWon: 'Closed Won',
  OrderClosedWon: 'Closed Won',
  ClosedLost: 'Closed Lost',
  NoRequirementOrCold: 'No Requirement / Cold',
  TrialProblem: 'Trial Problem',
  Lead: 'New Lead',
};

export const STAGE_LABELS = DEAL_STAGE_LABELS;
export const DEAL_STAGES = Object.keys(DEAL_STAGE_LABELS) as DealStageValue[];

export const PROJ_STATUS_LABELS: Record<string, string> = {
  ProjectionCreated: 'Projection Created',
  FollowUpPending: 'Follow-up Pending',
  CustomerInterested: 'Customer Interested',
  WaitingApproval: 'Waiting Approval',
  POExpected: 'PO Expected',
  POReceived: 'PO Received',
  OrderPlaced: 'Order Placed',
  PartiallyConfirmed: 'Partially Confirmed',
  Confirmed: 'Confirmed',
  Completed: 'Completed',
  DeferredToNextMonth: 'Deferred to Next Month',
  Lost: 'Lost',
  Cancelled: 'Cancelled',
  InProgress: 'In Progress',
  NeedsAttention: 'Needs Attention',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  Created: 'Order Created',
  Acknowledged: 'Acknowledged',
  DeliveryPartnerAssigned: 'Delivery Assigned',
  Dispatched: 'Dispatched',
  DeliveredFromWarehouse: 'Dispatched from Hub',
  DeliveredToCustomer: 'Delivered',
  CustomerReceiptConfirmed: 'Receipt Confirmed',
  Cancelled: 'Cancelled',
};

export const PAY_ZONE_LABELS: Record<string, string> = {
  GreenZone: 'Green Zone',
  YellowZone: 'Yellow Zone',
  RedZone: 'Red Zone',
  Green: 'Green Zone',
  Yellow: 'Yellow Zone',
  Red: 'Red Zone',
  Blacklist: 'Blacklisted',
};

export const PAYMENT_TERMS_LABELS: Record<string, string> = {
  Immediate: 'Immediate (Net 0)',
  Credit15: 'Net 15 Days',
  Credit30: 'Net 30 Days',
  Credit45: 'Net 45 Days',
  CashOnDelivery: 'Cash on Delivery',
  Advance50Balance: '50% Adv + Balance COD',
  AdvancePayment: '100% Advance',
};

export const DELIVERY_MODE_LABELS: Record<string, string> = {
  TransportLR: 'Transport (LR)',
  Courier: 'Courier Service',
  CompanyVehicle: 'Company Vehicle',
  CustomerPickup: 'Customer Self-Pickup',
  HandDelivery: 'Direct Hand Delivery',
};

// Domain Entities
export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: Role;
  region: string;
  division: DivisionValue;
  avatarUrl?: string | null;
  active: boolean;
  phone?: string;
  designation?: string;
  managerName?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  designation?: string | null;
  isPrimary: boolean;
}

export interface Customer {
  id: string;
  name: string;
  legalName?: string;
  division?: DivisionValue;
  category?: CustomerCategoryValue;
  tier?: string;
  type?: CustomerTypeValue;
  industryId?: string | null;
  industryName?: string;
  industry?: string;
  subIndustry?: string | null;
  area?: string;
  city?: string;
  address: string;
  paymentTerms?: PaymentTermsValue | string;
  paymentTermsDays?: number;
  creditLimit?: number;
  payZone?: PayZoneValue;
  paymentZone?: PaymentZoneValue;
  outstanding: number;
  active?: boolean;
  salespersonId: string;
  salespersonName: string;
  contacts: Contact[];
  primaryContactName?: string;
  primaryContactPhone?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  principalId: string;
  principalName: string;
  division?: DivisionValue;
  basePrice: number;
  catalogPrice?: number;
  sku: string;
  unit: string;
  packSize?: string;
}

export interface Principal {
  id: string;
  name: string;
  division?: DivisionValue;
}

export interface LeadProduct {
  id: string;
  productId: string;
  productName: string;
  principalId?: string | null;
  brand?: string | null;
  qty: number;
  unit: string;
  price: number;
  value: number;
}

export interface Lead {
  id: string;
  title?: string;
  customerId?: string;
  customerName: string;
  division?: DivisionValue;
  tier?: CustomerCategoryValue | string;
  type?: CustomerTypeValue;
  salespersonId: string;
  salespersonName: string;
  stage: DealStageValue;
  productId?: string;
  productName?: string;
  principalId?: string;
  principalName?: string;
  industryId?: string | null;
  industryName?: string;
  area?: string;
  address?: string | null;
  contacts?: Contact[];
  contactName?: string;
  phone?: string;
  nextFollowUp?: string | null;
  nextFollowUpDate?: string | null;
  expClose?: string | null;
  expectedClose?: string;
  stageUpdatedAt: string;
  products?: LeadProduct[];
  totalValue?: number;
  value?: number;
  probability: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectionLine {
  id: string;
  month?: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  principalId: string;
  principalName: string;
  sku: string;
  mappingId?: string;
  salespersonId: string;
  salespersonName: string;
  basePrice?: number;
  rate?: number;
  customPrice?: number | null;
  effectivePrice?: number;
  projectedQty?: number;
  projectedQuantity?: number;
  achievedQty?: number;
  achievedQuantity?: number;
  committedValue?: number;
  achievedValue?: number;
  achievementPct?: number;
  achievementPercentage?: number;
  status: ProjStatusValue;
  expClose?: string | null;
  nextFollowUp?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  qty?: number;
  quantity?: number;
  price?: number;
  rate?: number;
  unit?: string;
  lineTotal?: number;
  subtotal?: number;
}

export interface OrderStatusHistory {
  id: string;
  status: OrderStatusValue;
  note: string | null;
  changedById: string;
  changedByName: string;
  at: string;
}

export interface SalesOrder {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  salespersonId: string;
  salespersonName: string;
  date?: string;
  status: OrderStatusValue;
  subtotal: number;
  taxMode?: TaxModeValue;
  taxRate?: number | null;
  taxAmount?: number;
  tax?: number;
  total: number;
  isUrgent?: boolean;
  paymentTerms?: string;
  advanceAmount?: number | null;
  advanceRef?: string | null;
  deliveryMode?: DeliveryModeValue;
  deliveryAddress: string;
  expectedDelivery: string;
  transporterName?: string | null;
  transporter?: string | null;
  lrNumber?: string | null;
  deliveryInstructions?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentFollowup {
  id: string;
  date: string;
  note: string;
  nextFollowupDate: string | null;
}

export interface Payment {
  id: string;
  refNo?: string;
  customerId: string;
  customerName: string;
  salespersonId: string;
  salespersonName: string;
  invoiceNo?: string;
  invoiceCode?: string;
  invoiceDate?: string;
  amount: number;
  received?: number;
  pending?: number;
  dueDate: string;
  agingDays: number;
  payZone?: PayZoneValue;
  paymentZone?: PaymentZoneValue;
  delayReason?: string | null;
  nextFollowUp?: string | null;
  mail1: boolean;
  mail2: boolean;
  mail3: boolean;
  mail4: boolean;
  mail1At?: string | null;
  mail2At?: string | null;
  mail3At?: string | null;
  mail4At?: string | null;
  status: PaymentStatusValue;
  followups?: PaymentFollowup[];
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  entityType: EntityTypeValue;
  entityId: string;
  customerId?: string;
  customerName?: string;
  salespersonId: string;
  salespersonName?: string;
  title: string;
  subtitle?: string | null;
  notes?: string | null;
  amount?: number | null;
  dueDate: string;
  dueTime?: string;
  priority?: 'High' | 'Medium' | 'Low';
  status?: 'Overdue' | 'Today' | 'Upcoming' | 'Completed';
  done: boolean;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Mapping {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  productSku?: string | null;
  principalId: string;
  principalName: string;
  salespersonId: string;
  salespersonName: string;
  catalogPrice?: number;
  basePrice?: number;
  customPrice: number | null;
  effectivePrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  entityType: EntityTypeValue;
  entityId: string;
  customerId?: string;
  customerName?: string;
  title?: string;
  type: 'call' | 'whatsapp' | 'stage_change' | 'remark' | 'order' | 'payment' | 'followup' | 'followup_done';
  description: string;
  performedById?: string;
  performedByName?: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  type: 'followup_due' | 'followup_overdue' | 'payment_overdue' | 'payment_alert' | 'payment_received' | 'order_update' | 'stage_change' | 'system';
  title: string;
  message: string;
  entityType?: EntityTypeValue;
  entityId?: string;
  read?: boolean;
  isRead?: boolean;
  createdAt: string;
}

export interface DashboardMetrics {
  period?: string;
  recurringCommitted: number;
  recurringAchieved: number;
  recurringPct?: number;
  newSalesCommitted: number;
  newSalesAchieved: number;
  totalCommitted: number;
  totalAchieved: number;
  totalPct?: number;
  achievementPercentage: number;
  followUpsDue: number;
  followUpsOverdue: number;
  target?: number;
  targetPct?: number;
  remainingGap?: number;
  pendingPaymentsTotal?: number;
  redZonePaymentsCount?: number;
}
