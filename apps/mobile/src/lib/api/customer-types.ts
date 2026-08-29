/**
 * Customer wire types, mirrored from `@greatsales/shared` (the API's source of
 * truth) and kept identical to the web app's copy. Label maps turn enum values
 * into human copy for the UI.
 */
export const CUSTOMER_CATEGORIES = ['Platinum', 'Gold', 'Silver', 'Brass'] as const;
export const PAYMENT_TERMS = [
  'Immediate',
  'Credit15',
  'Credit30',
  'Credit45',
  'CashOnDelivery',
  'AdvancePayment',
] as const;
export const PAY_ZONES = ['RedZone', 'YellowZone', 'GreenZone', 'Blacklist'] as const;

export type CustomerCategory = (typeof CUSTOMER_CATEGORIES)[number];
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];
export type PayZone = (typeof PAY_ZONES)[number];

export const PAYMENT_TERMS_LABEL: Record<PaymentTerms, string> = {
  Immediate: 'Immediate',
  Credit15: '15 days credit',
  Credit30: '30 days credit',
  Credit45: '45 days credit',
  CashOnDelivery: 'Cash on delivery',
  AdvancePayment: 'Advance payment',
};

export const PAY_ZONE_LABEL: Record<PayZone, string> = {
  RedZone: 'Red',
  YellowZone: 'Yellow',
  GreenZone: 'Green',
  Blacklist: 'Blacklist',
};

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';
export const PAY_ZONE_TONE: Record<PayZone, BadgeTone> = {
  GreenZone: 'success',
  YellowZone: 'warning',
  RedZone: 'error',
  Blacklist: 'error',
};

export interface CustomerContactDto {
  id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

export interface CustomerListItem {
  id: string;
  name: string;
  category: CustomerCategory | null;
  payZone: PayZone | null;
  area: string | null;
  salespersonId: string;
  salespersonName: string | null;
  createdAt: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  category: CustomerCategory | null;
  industryId: string | null;
  industryName: string | null;
  subIndustry: string | null;
  area: string | null;
  paymentTerms: PaymentTerms | null;
  payZone: PayZone | null;
  salespersonId: string;
  salespersonName: string | null;
  contacts: CustomerContactDto[];
  createdAt: string;
  updatedAt: string;
}

export interface IndustryDto {
  id: string;
  name: string;
  subIndustries: string[];
}

export interface CustomerFormValues {
  name: string;
  category?: CustomerCategory;
  industryId?: string;
  subIndustry?: string;
  area?: string;
  paymentTerms?: PaymentTerms;
  payZone?: PayZone;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
