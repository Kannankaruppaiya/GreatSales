/**
 * The app's navigable features — one entry per routed surface.
 *
 * This is the single place a feature is declared. The sidebar, the topbar
 * title, the command palette and the route-level RoleGuard all derive from it,
 * so adding or removing a page is one edit here plus its route in App.tsx,
 * instead of the five hand-maintained lists this replaces.
 */
import {
  Boxes,
  Building2,
  CalendarClock,
  Database,
  LayoutDashboard,
  Link2,
  Receipt,
  Repeat,
  ShoppingCart,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/data/constants";

export type Feature = {
  /** Route segment under /managements/:managementId/ — also the registry key. */
  key: string;
  /** Sidebar label. */
  label: string;
  /** Sidebar label for roles that see the surface differently (sales sees only their own records). */
  labelByRole?: Partial<Record<Role, string>>;
  /** Topbar heading. */
  title: string;
  /** Command palette entry. */
  paletteLabel: string;
  paletteDesc: string;
  icon: LucideIcon;
  /** Roles allowed to reach the surface. Drives the sidebar, the palette and RoleGuard alike. */
  roles: Role[];
};

const ALL_ROLES: Role[] = ["super_admin", "admin", "mgmt", "sales"];

export const FEATURES: Feature[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    title: "Executive Overview",
    paletteLabel: "Dashboard",
    paletteDesc: "Executive metrics & performance",
    icon: LayoutDashboard,
    roles: ALL_ROLES,
  },
  {
    key: "projections",
    label: "Recurring Projections",
    title: "Recurring Sales Projections",
    paletteLabel: "Projections",
    paletteDesc: "Recurring sales worksheet & commitments",
    icon: Repeat,
    roles: ALL_ROLES,
  },
  {
    key: "leads",
    label: "New Sales Customers",
    title: "New Sales Pipeline & Leads",
    paletteLabel: "New Sales Pipeline",
    paletteDesc: "Leads & deal stages kanban",
    icon: Target,
    roles: ALL_ROLES,
  },
  {
    key: "orders",
    label: "Sales Orders",
    title: "Sales Order Fulfillment",
    paletteLabel: "Sales Orders",
    paletteDesc: "Order fulfillment & dispatch tracking",
    icon: ShoppingCart,
    roles: ALL_ROLES,
  },
  {
    key: "payments",
    label: "Payments Follow-up",
    title: "Payments & Receivables Follow-up",
    paletteLabel: "Payments Follow-Up",
    paletteDesc: "Aging invoices & credit control",
    icon: Receipt,
    roles: ALL_ROLES,
  },
  {
    key: "followups",
    label: "Follow-ups",
    title: "Actionable Timeline",
    paletteLabel: "Actionable Follow-Ups",
    paletteDesc: "Unified timeline & contact agenda",
    icon: CalendarClock,
    roles: ALL_ROLES,
  },
  {
    key: "customers",
    label: "Customers",
    labelByRole: { sales: "My Customers" },
    title: "Customer Master Directory",
    paletteLabel: "Customers Directory",
    paletteDesc: "Accounts, tiers, & mapping counts",
    icon: Building2,
    roles: ALL_ROLES,
  },
  {
    key: "products",
    label: "Products",
    title: "Product & Principal Catalog",
    paletteLabel: "Products Catalog",
    paletteDesc: "Principals & SKU price master",
    icon: Boxes,
    roles: ["super_admin", "admin", "mgmt"],
  },
  {
    key: "mappings",
    label: "Customer Mapping",
    labelByRole: { sales: "My Customer Mapping" },
    title: "Customer & Product Mapping",
    paletteLabel: "Customer Mapping",
    paletteDesc: "Customer × product mapping grid",
    icon: Link2,
    roles: ALL_ROLES,
  },
  {
    key: "users",
    label: "Users",
    title: "Team & User Governance",
    paletteLabel: "Users & Governance",
    paletteDesc: "Team roles & accounts assignment",
    icon: UsersRound,
    roles: ["super_admin", "admin"],
  },
  {
    key: "data",
    label: "Data",
    title: "Data Administration & Periods",
    paletteLabel: "Data Administration",
    paletteDesc: "Import jobs, periods & data admin",
    icon: Database,
    roles: ["super_admin", "admin"],
  },
];

const BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));

export const featureByKey = (key: string): Feature | undefined => BY_KEY.get(key);

/** The features a role may reach, in sidebar order. */
export const featuresFor = (role: Role): Feature[] =>
  FEATURES.filter((f) => f.roles.includes(role));

/** The sidebar label for a feature as this role should see it. */
export const featureLabel = (f: Feature, role: Role): string =>
  f.labelByRole?.[role] ?? f.label;

/** Absolute path to a feature inside a management workspace. */
export const featurePath = (key: string, managementId: string): string =>
  `/managements/${managementId}/${key}`;
