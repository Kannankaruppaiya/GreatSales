import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Customer,
  Lead,
  Payment,
  Principal,
  Product,
  Projection,
  SalesOrder,
  User,
} from "@/data/types";
import type { WorkspaceProfile } from "@/store/trackerStore";
import { DEFAULT_MANAGEMENT_ID } from "@/store/ui";

export interface ManagementSummary {
  id: string;
  name: string;
  initials: string;
  industry: string;
  currency: string;
  createdAt: string;
}

export interface TrackerData {
  users: User[];
  principals: Principal[];
  products: Product[];
  customers: Customer[];
  projections: Projection[];
  leads: Lead[];
  orders: SalesOrder[];
  payments: Payment[];
  profile: WorkspaceProfile;
}

export interface CreateManagementInput {
  name: string;
  industry: string;
  currency: string;
  timezone: string;
  adminName: string;
  adminEmail: string;
}

export function emptyDataset(profile: WorkspaceProfile): TrackerData {
  return {
    users: [],
    principals: [],
    products: [],
    customers: [],
    projections: [],
    leads: [],
    orders: [],
    payments: [],
    profile,
  };
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "M";

/** Human-readable, URL-safe slug from a company name (e.g. "Nova Foods" -> "nova-foods"). */
const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "management";

/** A slug unique among the given taken ids ("acme", "acme-2", "acme-3", ...). */
const uniqueSlug = (name: string, taken: Set<string>) => {
  const base = slugify(name);
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
};

interface ManagementState {
  managements: ManagementSummary[];
  datasets: Record<string, TrackerData>;
  createManagement: (input: CreateManagementInput) => string;
  getDataset: (id: string) => TrackerData | undefined;
  saveDataset: (id: string, data: TrackerData) => void;
}

export const useManagementStore = create<ManagementState>()(
  persist(
    (set, get) => ({
      managements: [
        {
          id: DEFAULT_MANAGEMENT_ID,
          name: "GreatSales Industrial Corp",
          initials: "GS",
          industry: "Industrial",
          currency: "INR (₹)",
          createdAt: "2026-08-19",
        },
      ],
      datasets: {},
      createManagement: (input) => {
        const id = uniqueSlug(input.name, new Set(get().managements.map((m) => m.id)));
        const profile: WorkspaceProfile = {
          name: input.name,
          subdomain: id,
          currency: input.currency,
          fiscalYearStart: "April",
        };
        const data = emptyDataset(profile);
        data.users = [
          {
            id: "u_01",
            name: input.adminName || "Admin",
            email: input.adminEmail,
            role: "admin",
            active: true,
            lastLogin: null,
          } satisfies User,
        ];
        set((state) => ({
          managements: [
            ...state.managements,
            {
              id,
              name: input.name,
              initials: initials(input.name),
              industry: input.industry,
              currency: input.currency,
              createdAt: new Date().toISOString().slice(0, 10),
            },
          ],
          datasets: { ...state.datasets, [id]: data },
        }));
        return id;
      },
      getDataset: (id) => get().datasets[id],
      saveDataset: (id, data) =>
        set((state) => ({ datasets: { ...state.datasets, [id]: data } })),
    }),
    {
      name: "greatsales_managements_v1",
      version: 2,
      // v2: management ids became readable slugs (were "m_default" / "m_<name>_<ts>").
      // Reset to the fresh default seed so ids stay consistent with the new scheme.
      migrate: () => ({
        managements: [
          {
            id: DEFAULT_MANAGEMENT_ID,
            name: "GreatSales Industrial Corp",
            initials: "GS",
            industry: "Industrial",
            currency: "INR (₹)",
            createdAt: "2026-08-19",
          },
        ],
        datasets: {},
      }),
    },
  ),
);
