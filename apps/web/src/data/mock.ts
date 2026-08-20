import {
  POC_CUSTOMERS,
  POC_LEADS,
  POC_ORDERS,
  POC_PAYMENTS,
  POC_PRINCIPALS,
  POC_PRODUCTS,
  POC_PROJECTIONS,
  POC_USERS,
} from "@/data/pocSeedData";
import type { Lead } from "@/data/types";

export const CURRENT_MONTH = "2026-08";

export const users = POC_USERS;
export const salespeople = users.filter((u) => u.role === "sales");
export const principals = POC_PRINCIPALS;
export const products = POC_PRODUCTS;
export const customers = POC_CUSTOMERS;
export const projections = POC_PROJECTIONS;
export const leads = POC_LEADS;
export const orders = POC_ORDERS;
export const payments = POC_PAYMENTS;
export const followUps: any[] = [];
export const followups: any[] = [];

export const leadTotal = (l: Lead) =>
  (l.products || []).reduce((s, p) => s + (p.value || 0), 0);
