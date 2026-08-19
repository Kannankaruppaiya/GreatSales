import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Customer,
  Lead,
  Payment,
  Principal,
  Product,
  Projection,
  RemarkEntry,
  SalesOrder,
  User,
} from "../data/types";
import type { DealStage, PayZone, SoStatus } from "../data/constants";
import {
  POC_CUSTOMERS,
  POC_LEADS,
  POC_ORDERS,
  POC_PAYMENTS,
  POC_PRINCIPALS,
  POC_PRODUCTS,
  POC_PROJECTIONS,
  POC_USERS,
} from "../data/pocSeedData";

export interface WorkspaceProfile {
  name: string;
  subdomain: string;
  currency: string;
  fiscalYearStart: string;
}

export interface TrackerState {
  users: User[];
  principals: Principal[];
  products: Product[];
  customers: Customer[];
  projections: Projection[];
  leads: Lead[];
  orders: SalesOrder[];
  payments: Payment[];
  profile: WorkspaceProfile;

  // Projections actions
  updateProjectionCell: (id: string, field: keyof Projection, value: any) => void;
  changeProjectionPrincipal: (id: string, newPrincipalId: string) => void;
  changeProjectionProduct: (id: string, newProductId: string) => void;
  addProjectionRemark: (id: string, text: string, userName: string) => void;
  setProjectionFollowUp: (id: string, date: string | null, expClose?: string | null, prob?: number | null, status?: string | null) => void;
  addProjection: (p: Omit<Projection, "id" | "remarks">) => void;
  deleteProjection: (id: string) => void;

  // Leads actions
  addLead: (lead: Omit<Lead, "id" | "createdAt" | "remarks">, initialRemark?: string, userName?: string) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  updateLeadStage: (id: string, stage: DealStage, userName?: string) => void;
  addLeadRemark: (id: string, text: string, userName: string) => void;
  setLeadFollowUp: (id: string, date: string | null, expClose?: string | null) => void;
  deleteLead: (id: string) => void;

  // Sales Orders actions
  createSalesOrder: (so: Omit<SalesOrder, "id" | "code" | "history" | "createdAt">, fromProjectionId?: string) => string;
  advanceSalesOrder: (id: string, nextStatus: SoStatus, note?: string, by?: string, extra?: { partner?: string; deliveryTime?: string; receiptTime?: string }) => void;
  cancelSalesOrder: (id: string, reason: string, by?: string) => void;

  // Payments actions
  addPayment: (p: Omit<Payment, "id" | "remarks">) => void;
  importPayments: (rows: Omit<Payment, "id" | "remarks">[]) => { added: number; skipped: number };
  updatePaymentField: (id: string, field: keyof Payment, value: any) => void;
  updatePaymentZone: (id: string, zone: PayZone) => void;
  togglePaymentMail: (id: string, mailKey: "mail1" | "mail2" | "mail3" | "mail4") => void;
  addPaymentRemark: (id: string, text: string, userName: string) => void;
  setPaymentFollowUp: (id: string, date: string | null) => void;
  deletePayment: (id: string) => void;

  // Customers actions
  addCustomer: (c: Omit<Customer, "id" | "outstanding">, initialProducts?: { productId: string; price: number }[]) => string;
  updateCustomer: (id: string, c: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Products & Principals actions
  addPrincipal: (name: string) => void;
  addProduct: (p: Omit<Product, "id">) => void;
  updateProduct: (id: string, p: Partial<Product>) => void;
  updateProductPrice: (id: string, price: number) => void;

  // Users & Reassignment actions
  addUser: (u: Omit<User, "id" | "lastLogin">) => void;
  updateUser: (id: string, u: Partial<User>) => void;
  toggleUserActive: (id: string) => void;
  reassignCustomers: (customerIds: string[], targetOwnerId: string) => void;

  // Workspace actions
  updateProfile: (p: Partial<WorkspaceProfile>) => void;
  resetToSampleData: () => void;
  clearAllData: () => void;
}

export const useTrackerStore = create<TrackerState>()(
  persist(
    (set, get) => ({
      users: POC_USERS,
      principals: POC_PRINCIPALS,
      products: POC_PRODUCTS,
      customers: POC_CUSTOMERS,
      projections: POC_PROJECTIONS,
      leads: POC_LEADS,
      orders: POC_ORDERS,
      payments: POC_PAYMENTS,
      profile: {
        name: "GreatSales Industrial Corp",
        subdomain: "greatsales",
        currency: "INR (₹)",
        fiscalYearStart: "April",
      },

      // Projections
      updateProjectionCell: (id, field, value) => {
        set((state) => ({
          projections: state.projections.map((p) => {
            if (p.id !== id) return p;
            const updated = { ...p, [field]: value };
            if (field === "projectedQty" && value && (!p.status || p.status === "Deferred to Next Month")) {
              updated.status = "Projection Created";
            }
            return updated;
          }),
        }));
      },

      changeProjectionPrincipal: (id, newPrincipalId) => {
        const { products } = get();
        const availableProds = products.filter((pr) => pr.principalId === newPrincipalId);
        if (!availableProds.length) return;
        const targetProd = availableProds[0];
        set((state) => ({
          projections: state.projections.map((p) =>
            p.id === id
              ? {
                  ...p,
                  productId: targetProd.id,
                  price: targetProd.listPrice || 0,
                  customPrice: targetProd.listPrice || 0,
                }
              : p
          ),
        }));
      },

      changeProjectionProduct: (id, newProductId) => {
        const { products } = get();
        const prod = products.find((pr) => pr.id === newProductId);
        if (!prod) return;
        set((state) => ({
          projections: state.projections.map((p) =>
            p.id === id
              ? {
                  ...p,
                  productId: newProductId,
                  price: prod.listPrice || 0,
                  customPrice: prod.listPrice || 0,
                }
              : p
          ),
        }));
      },

      addProjectionRemark: (id, text, userName) => {
        const today = new Date().toISOString().slice(0, 10);
        set((state) => ({
          projections: state.projections.map((p) =>
            p.id === id
              ? {
                  ...p,
                  remarks: [{ id: `rmk_${Date.now()}`, date: today, user: userName, text }, ...(p.remarks || [])],
                }
              : p
          ),
        }));
      },

      setProjectionFollowUp: (id, date, expClose, prob, status) => {
        set((state) => ({
          projections: state.projections.map((p) => {
            if (p.id !== id) return p;
            const updated: Projection = { ...p, nextFollowUp: date };
            if (expClose !== undefined) updated.targetDate = expClose;
            if (prob !== undefined && prob !== null) updated.probability = prob;
            if (status) updated.status = status as any;
            return updated;
          }),
        }));
      },

      addProjection: (p) => {
        const id = `pj_${Date.now()}`;
        set((state) => ({
          projections: [{ ...p, id, remarks: [] }, ...state.projections],
        }));
      },

      deleteProjection: (id) => {
        set((state) => ({
          projections: state.projections.filter((p) => p.id !== id),
        }));
      },

      // Leads
      addLead: (lead, initialRemark, userName) => {
        const id = `L${String(Math.floor(1000 + Math.random() * 9000))}`;
        const today = new Date().toISOString().slice(0, 10);
        const remarks: RemarkEntry[] = initialRemark
          ? [{ id: `rmk_${Date.now()}`, date: today, user: userName || "User", text: initialRemark }]
          : [];
        set((state) => ({
          leads: [{ ...lead, id, createdAt: today, stageUpdatedAt: today, remarks }, ...state.leads],
        }));
      },

      updateLead: (id, patch) => {
        set((state) => ({
          leads: state.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        }));
      },

      updateLeadStage: (id, stage, userName) => {
        const today = new Date().toISOString().slice(0, 10);
        set((state) => ({
          leads: state.leads.map((l) =>
            l.id === id
              ? {
                  ...l,
                  stage,
                  stageUpdatedAt: today,
                  remarks: [
                    {
                      id: `rmk_${Date.now()}`,
                      date: today,
                      user: userName || "System",
                      text: `Stage changed to "${stage}"`,
                    },
                    ...(l.remarks || []),
                  ],
                }
              : l
          ),
        }));
      },

      addLeadRemark: (id, text, userName) => {
        const today = new Date().toISOString().slice(0, 10);
        set((state) => ({
          leads: state.leads.map((l) =>
            l.id === id
              ? {
                  ...l,
                  remarks: [{ id: `rmk_${Date.now()}`, date: today, user: userName, text }, ...(l.remarks || [])],
                }
              : l
          ),
        }));
      },

      setLeadFollowUp: (id, date, expClose) => {
        set((state) => ({
          leads: state.leads.map((l) =>
            l.id === id
              ? {
                  ...l,
                  nextFollowUp: date,
                  expClose: expClose !== undefined ? expClose : l.expClose,
                }
              : l
          ),
        }));
      },

      deleteLead: (id) => {
        set((state) => ({
          leads: state.leads.filter((l) => l.id !== id),
        }));
      },

      // Sales Orders
      createSalesOrder: (so, fromProjectionId) => {
        const nextNum = get().orders.length + 1;
        const id = `SO${String(nextNum).padStart(4, "0")}`;
        const code = `SO/26-27/${String(nextNum).padStart(4, "0")}`;
        const nowIso = new Date().toISOString();
        const newOrder: SalesOrder = {
          ...so,
          id,
          code,
          createdAt: nowIso,
          history: [{ status: "Created", timestamp: nowIso, note: "Order created", by: so.createdBy || "System" }],
        };
        set((state) => ({
          orders: [newOrder, ...state.orders],
          projections: fromProjectionId
            ? state.projections.map((p) =>
                p.id === fromProjectionId ? { ...p, salesOrderId: id, status: "Confirmed" } : p
              )
            : state.projections,
        }));
        return id;
      },

      advanceSalesOrder: (id, nextStatus, note, by, extra) => {
        const nowIso = new Date().toISOString();
        set((state) => ({
          orders: state.orders.map((o) => {
            if (o.id !== id) return o;
            const updated: SalesOrder = {
              ...o,
              status: nextStatus,
              transporterName: extra?.partner || o.transporterName,
              history: [
                ...(o.history || []),
                { status: nextStatus, timestamp: nowIso, note: note || `Stage advanced to ${nextStatus}`, by },
              ],
            };
            return updated;
          }),
        }));
      },

      cancelSalesOrder: (id, reason, by) => {
        const nowIso = new Date().toISOString();
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: "Cancelled",
                  cancelReason: reason,
                  cancelledAt: nowIso,
                  history: [
                    ...(o.history || []),
                    { status: "Cancelled", timestamp: nowIso, note: `Cancelled: ${reason}`, by },
                  ],
                }
              : o
          ),
        }));
      },

      // Payments
      addPayment: (p) => {
        const id = `pay_${Date.now()}`;
        set((state) => ({
          payments: [{ ...p, id, remarks: [] }, ...state.payments],
        }));
      },

      importPayments: (rows) => {
        const existingRefs = new Set(get().payments.map((p) => (p.refNo || "").trim().toUpperCase()).filter(Boolean));
        const toAdd: Payment[] = [];
        let skipped = 0;

        rows.forEach((r) => {
          const key = (r.refNo || "").trim().toUpperCase();
          if (key && existingRefs.has(key)) {
            skipped++;
          } else {
            if (key) existingRefs.add(key);
            toAdd.push({
              ...r,
              id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              remarks: [],
            });
          }
        });

        if (toAdd.length > 0) {
          set((state) => ({ payments: [...toAdd, ...state.payments] }));
        }
        return { added: toAdd.length, skipped };
      },

      updatePaymentField: (id, field, value) => {
        set((state) => ({
          payments: state.payments.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
        }));
      },

      updatePaymentZone: (id, zone) => {
        set((state) => ({
          payments: state.payments.map((p) => (p.id === id ? { ...p, zone } : p)),
        }));
      },

      togglePaymentMail: (id, mailKey) => {
        set((state) => ({
          payments: state.payments.map((p) => (p.id === id ? { ...p, [mailKey]: !p[mailKey] } : p)),
        }));
      },

      addPaymentRemark: (id, text, userName) => {
        const today = new Date().toISOString().slice(0, 10);
        set((state) => ({
          payments: state.payments.map((p) =>
            p.id === id
              ? {
                  ...p,
                  remarks: [{ id: `rmk_${Date.now()}`, date: today, user: userName, text }, ...(p.remarks || [])],
                }
              : p
          ),
        }));
      },

      setPaymentFollowUp: (id, date) => {
        set((state) => ({
          payments: state.payments.map((p) => (p.id === id ? { ...p, nextFollowUp: date } : p)),
        }));
      },

      deletePayment: (id) => {
        set((state) => ({
          payments: state.payments.filter((p) => p.id !== id),
        }));
      },

      // Customers
      addCustomer: (c, initialProducts) => {
        const nextNum = get().customers.length + 1;
        const id = `C${String(nextNum).padStart(3, "0")}`;
        const newCust: Customer = { ...c, id, outstanding: 0 };
        const newProjections: Projection[] = [];

        if (initialProducts && initialProducts.length > 0) {
          const currentMonth = "2026-08";
          initialProducts.forEach((ip) => {
            newProjections.push({
              id: `pj_${id}_${ip.productId}_${currentMonth}`,
              month: currentMonth,
              customerId: id,
              productId: ip.productId,
              ownerId: c.ownerId,
              projectedQty: 0,
              achievedQty: 0,
              price: ip.price,
              customPrice: ip.price,
              status: "Projection Created",
              nextFollowUp: null,
              remarks: [],
            });
          });
        }

        set((state) => ({
          customers: [newCust, ...state.customers],
          projections: [...newProjections, ...state.projections],
        }));
        return id;
      },

      updateCustomer: (id, c) => {
        set((state) => {
          const newOwnerId = c.ownerId;
          return {
            customers: state.customers.map((cust) => (cust.id === id ? { ...cust, ...c } : cust)),
            projections: newOwnerId
              ? state.projections.map((p) => (p.customerId === id ? { ...p, ownerId: newOwnerId } : p))
              : state.projections,
          };
        });
      },

      deleteCustomer: (id) => {
        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
          projections: state.projections.filter((p) => p.customerId !== id),
        }));
      },

      // Products & Principals
      addPrincipal: (name) => {
        const clean = name.trim().toUpperCase();
        const id = `pr_${clean.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        set((state) => ({
          principals: [...state.principals.filter((p) => p.id !== id), { id, name: clean }],
        }));
      },

      addProduct: (p) => {
        const nextNum = get().products.length + 1;
        const id = `P${String(nextNum).padStart(3, "0")}`;
        set((state) => ({
          products: [{ ...p, id, sku: id }, ...state.products],
        }));
      },

      updateProduct: (id, p) => {
        set((state) => ({
          products: state.products.map((prod) => (prod.id === id ? { ...prod, ...p } : prod)),
        }));
      },

      updateProductPrice: (id, price) => {
        set((state) => ({
          products: state.products.map((prod) => (prod.id === id ? { ...prod, listPrice: price } : prod)),
        }));
      },

      // Users & Reassignment
      addUser: (u) => {
        const nextNum = get().users.length + 1;
        const id = `u_${String(nextNum).padStart(2, "0")}`;
        set((state) => ({
          users: [...state.users, { ...u, id, lastLogin: null }],
        }));
      },

      updateUser: (id, u) => {
        set((state) => ({
          users: state.users.map((usr) => (usr.id === id ? { ...usr, ...u } : usr)),
        }));
      },

      toggleUserActive: (id) => {
        set((state) => ({
          users: state.users.map((u) => (u.id === id ? { ...u, active: !u.active } : u)),
        }));
      },

      reassignCustomers: (customerIds, targetOwnerId) => {
        const idSet = new Set(customerIds);
        set((state) => ({
          customers: state.customers.map((c) =>
            idSet.has(c.id) ? { ...c, ownerId: targetOwnerId, collectorId: targetOwnerId } : c
          ),
          projections: state.projections.map((p) =>
            idSet.has(p.customerId) ? { ...p, ownerId: targetOwnerId } : p
          ),
          leads: state.leads.map((l) => (idSet.has(l.id) ? { ...l, ownerId: targetOwnerId } : l)),
        }));
      },

      // Workspace profile
      updateProfile: (p) => {
        set((state) => ({
          profile: { ...state.profile, ...p },
        }));
      },

      resetToSampleData: () => {
        set({
          users: POC_USERS,
          principals: POC_PRINCIPALS,
          products: POC_PRODUCTS,
          customers: POC_CUSTOMERS,
          projections: POC_PROJECTIONS,
          leads: POC_LEADS,
          orders: POC_ORDERS,
          payments: POC_PAYMENTS,
        });
      },

      clearAllData: () => {
        set({
          customers: [],
          projections: [],
          leads: [],
          orders: [],
          payments: [],
        });
      },
    }),
    {
      name: "greatsales_tracker_poc_v6_data_v2",
      version: 2,
    }
  )
);
