import type {
  CustomerTier,
  DealStage,
  DeliveryMode,
  Division,
  PayZone,
  ProjStatus,
  Role,
  SoStatus,
} from "@/data/constants";

export interface RemarkEntry {
  id?: string;
  date?: string;
  timestamp?: string;
  user?: string;
  userName?: string;
  text: string;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: Role;
  active: boolean;
  lastLogin: string | null;
  password?: string;
}

export interface Principal {
  id: string;
  name: string; // brand / supplier
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  principalId: string;
  principalName?: string;
  division?: Division; // LUB / WES — which business line the SKU belongs to
  unit: string;
  listPrice: number;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  division: Division;
  tier: CustomerTier;
  type?: "Existing" | "New";
  industry: string;
  subIndustry?: string;
  area: string;
  contactName: string;
  phone: string;
  mobile?: string;
  whatsapp?: string;
  sameAsMobile?: boolean; // WhatsApp mirrors the mobile number
  email?: string;
  ownerId: string; // salesperson
  collectorId?: string; // payment collector
  paymentTerms?: string;
  payZone: PayZone;
  outstanding: number;
  active: boolean;
}

export interface CustomerProductMapping {
  id: string;
  customerId: string;
  productId: string;
  ownerId: string;
  customPrice?: number | null;
}

/** A recurring projection line for one customer×product in one month. */
export interface Projection {
  id: string;
  mapId?: string | null;
  month: string;
  customerId: string;
  productId: string;
  ownerId: string;
  projectedQty: number;
  achievedQty: number;
  price: number; // list price or effective price
  customPrice?: number | null;
  probability?: number; // 0–100 win confidence, drives weighted pipeline
  status: ProjStatus;
  nextFollowUp: string | null;
  targetDate?: string | null;
  remarks: RemarkEntry[];
  salesOrderId?: string | null;
}

export interface LeadProduct {
  id?: string;
  principalId: string;
  productId?: string;
  name: string;
  qty: number;
  unit?: string;
  price: number;
  value: number;
}

export interface Lead {
  id: string;
  name: string;
  division?: Division;
  tier: CustomerTier;
  type?: "Existing" | "New";
  industry: string;
  subIndustry?: string;
  area: string;
  address?: string;
  contactName: string;
  phone: string;
  whatsapp?: string;
  sameAsMobile?: boolean;
  email?: string;
  ownerId: string;
  stage: DealStage;
  products: LeadProduct[];
  nextFollowUp: string | null;
  expClose: string | null;
  createdAt?: string;
  stageUpdatedAt?: string;
  remarks: RemarkEntry[];
}

export interface OrderLine {
  productId: string;
  productName: string;
  principalName?: string;
  qty: number;
  price: number;
  unit?: string;
}

export interface OrderStatusHistory {
  status: SoStatus;
  timestamp: string;
  note?: string;
  by?: string; // who moved the order to this stage
}

export interface SalesOrder {
  id: string;
  code: string;
  customerId: string;
  customerName?: string;
  ownerId: string;
  status: SoStatus;
  lines: OrderLine[];
  isUrgent?: boolean;
  paymentTerm?: string;
  paymentTerms?: string;
  advanceAmount?: number;
  advanceRef?: string;
  deliveryMode?: DeliveryMode; // how the goods move
  deliveryAddress?: string; // ship-to address
  expectedDelivery: string | null;
  transporterName?: string;
  lrNumber?: string;
  deliveryInstructions?: string;
  history: OrderStatusHistory[];
  cancelReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  createdBy?: string; // who raised the order
}

export interface Payment {
  id: string;
  refNo: string;
  customerId?: string | null;
  customerName: string;
  ownerId: string;
  invoiceNo?: string;
  invoiceDate: string;
  amount: number;
  pending: number;
  received: number;
  dueDate: string;
  zone: PayZone;
  delayReason?: string;
  nextFollowUp: string | null;
  mail1?: boolean;
  mail2?: boolean;
  mail3?: boolean;
  mail4?: boolean;
  remarks?: RemarkEntry[];
}

export type FollowUpKind = "projection" | "lead" | "payment";

export interface FollowUp {
  id: string;
  kind: FollowUpKind;
  targetId: string;
  title: string;
  subtitle: string;
  ownerId: string;
  dueDate: string;
  amount: number;
}
