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
  /**
   * Which top-bar filters this surface actually reads.
   *
   * The top bar renders only these. Before it did, the month and principal
   * selectors were drawn on every page while just two pages read `month` and
   * NOTHING read `principalId` — a control that silently does nothing is worse
   * than an absent one, because the user believes the list in front of them is
   * filtered. A filter belongs here only once the page passes it to its query.
   */
  globalFilters: GlobalFilter[];
};

/**
 * The filters the top bar can offer. Each maps to a field on the `ui` store.
 *
 * `window` is the day/week/month/year picker. Only the DASHBOARD declares it:
 * the worksheet-shaped pages are a month at a time by their data model and
 * carry their own month dropdown on the page, so drawing a window picker above
 * one would put two period controls on the same screen saying different things
 * — the topbar offering a week while the worksheet beneath it shows a month.
 */
export type GlobalFilter = "window" | "principal" | "owner";

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
    // No principal: DashboardQuerySchema takes the window + ownerId only.
    globalFilters: ["window", "owner"],
  },
  {
    key: "projections",
    label: "Recurring Projections",
    title: "Recurring Sales Projections",
    paletteLabel: "Projections",
    paletteDesc: "Recurring sales worksheet & commitments",
    icon: Repeat,
    roles: ALL_ROLES,
    // No window: this page picks its own month, on the page.
    globalFilters: ["principal", "owner"],
  },
  {
    key: "leads",
    label: "New Sales Customers",
    title: "New Sales Pipeline & Leads",
    paletteLabel: "New Sales Pipeline",
    paletteDesc: "Leads & deal stages kanban",
    icon: Target,
    roles: ALL_ROLES,
    globalFilters: ["principal", "owner"],
  },
  {
    key: "orders",
    label: "Sales Orders",
    title: "Sales Order Fulfillment",
    paletteLabel: "Sales Orders",
    paletteDesc: "Order fulfillment & dispatch tracking",
    icon: ShoppingCart,
    roles: ALL_ROLES,
    globalFilters: ["principal", "owner"],
  },
  {
    key: "payments",
    label: "Payments Follow-up",
    title: "Payments & Receivables Follow-up",
    paletteLabel: "Payments Follow-Up",
    paletteDesc: "Aging invoices & credit control",
    icon: Receipt,
    roles: ALL_ROLES,
  // No principal: a Payment has no product or principal relation at all.
    globalFilters: ["owner"],
  },
  {
    key: "followups",
    label: "Follow-ups",
    title: "Actionable Timeline",
    paletteLabel: "Actionable Follow-Ups",
    paletteDesc: "Unified timeline & contact agenda",
    icon: CalendarClock,
    roles: ALL_ROLES,
  // No month: FollowUp has a dueDate, not a reporting period.
    globalFilters: ["owner"],
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
    globalFilters: ["principal", "owner"],
  },
  {
    key: "products",
    label: "Products",
    title: "Product & Principal Catalog",
    paletteLabel: "Products Catalog",
    paletteDesc: "Principals & SKU price master",
    icon: Boxes,
    roles: ["super_admin", "admin", "mgmt"],
    globalFilters: ["principal"],
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
    globalFilters: ["owner", "principal"],
  },
  {
    key: "users",
    label: "Users",
    title: "Team & User Governance",
    paletteLabel: "Users & Governance",
    paletteDesc: "Team roles & accounts assignment",
    icon: UsersRound,
    roles: ["super_admin", "admin"],
  // Governance surfaces are tenant-wide; none of the three filters apply.
    globalFilters: [],
  },
  {
    key: "data",
    label: "Data",
    title: "Data Administration & Periods",
    paletteLabel: "Data Administration",
    paletteDesc: "Import jobs, periods & data admin",
    icon: Database,
    roles: ["super_admin", "admin"],
  // Administration is tenant-wide; the period it acts on is chosen on the page.
    globalFilters: [],
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

/**
 * Absolute path to a feature inside a management workspace.
 *
 * The role segment leads, so a signed-in URL says who is signed in:
 * `/admin/managements/m1/leads`, `/sales/managements/m1/leads`. See
 * `lib/rolePath.ts` for why, and `RequireRolePath` for the check that stops the
 * segment claiming a role the session does not hold.
 */
export const featurePath = (
  key: string,
  managementId: string,
  rolePath: string,
): string => `/${rolePath}/managements/${managementId}/${key}`;
