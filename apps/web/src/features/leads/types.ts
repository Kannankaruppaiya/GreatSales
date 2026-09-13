/**
 * One named human at the account, as the wire carries them.
 *
 * A deal is worked through more than one person — the purchase manager signs
 * the order, the plant head decides the trial — and this used to be four flat
 * columns on the lead, so only one of them could ever be recorded.
 */
export interface ContactRow {
  id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  whatsapp: string | null;
  sameAsMobile: boolean;
  email: string | null;
  isPrimary: boolean;
}

export interface ContactInput {
  name: string;
  designation?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  sameAsMobile?: boolean;
  email?: string | null;
  isPrimary?: boolean;
}

/**
 * Wire types for the leads (new-sales pipeline) API. These mirror the
 * `@greatsales/shared` LeadRow / LeadListResponse contracts; kept as a local
 * copy so the Vite build does not need to consume the CJS `shared` dist. The
 * API is the source of truth — keep this in sync with
 * packages/shared/src/lead.ts.
 *
 * `totalValue` is server-computed (sums the line-item values) — it is never
 * part of LeadCreate/LeadUpdate and must be rendered exactly as received,
 * never recomputed or sent back to the API.
 *
 * `products` may be sent on an update, and doing so REPLACES the lead's line
 * items with exactly what is sent. They used to be create-only, which fixed a
 * deal's quantity and price at the moment the enquiry was written down — on a
 * pipeline whose stages are named "Proposals & Price Quote" and "Negotiation /
 * Oral Confirmation", which are precisely the stages where those two numbers
 * move. Correcting one meant deleting the lead and retyping it.
 */

export interface LeadProductRow {
  id: string;
  principalId: string | null;
  productId: string | null;
  productName: string;
  brand: string | null;
  qty: number | null;
  unit: string | null;
  price: number | null;
  value: number | null;
}

export interface LeadProductInput {
  productName: string;
  principalId?: string | null;
  productId?: string | null;
  brand?: string | null;
  qty?: number | null;
  unit?: string | null;
  price?: number | null;
  value?: number | null;
}

export interface LeadRow {
  id: string;
  customerName: string;
  division: string | null;
  tier: string | null;
  type: string | null;
  salespersonId: string;
  salespersonName: string;
  stage: string;
  industryId: string | null;
  industryName: string | null;
  subIndustry: string | null;
  area: string | null;
  address: string | null;
  /** Everyone at this account, primary first. */
  contacts: ContactRow[];
  /** The primary's name and number, derived server-side for list cells. */
  contactName: string | null;
  phone: string | null;
  nextFollowUp: string | null;
  expClose: string | null;
  stageUpdatedAt: string | null;
  products: LeadProductRow[];
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListResponse {
  items: LeadRow[];
  nextCursor: string | null;
  /** Rows matching the filter, ignoring the cursor window. */
  total: number;
}

export interface LeadCreate {
  customerName: string;
  salespersonId: string;
  stage?: string;
  division?: string | null;
  tier?: string | null;
  type?: string | null;
  industryId?: string | null;
  subIndustry?: string | null;
  area?: string | null;
  address?: string | null;
  /** Sending this REPLACES the lead's contacts with exactly what is sent. */
  contacts?: ContactInput[];
  nextFollowUp?: string | null;
  expClose?: string | null;
  products?: LeadProductInput[];
}

/**
 * Sending `products` REPLACES the lead's line items with exactly what is sent;
 * omitting the key leaves them alone. They used to be excluded from this type
 * altogether — see the note above LeadProductRow.
 */
export type LeadUpdate = Partial<LeadCreate>;

/**
 * `stage` is a raw DB enum string on the wire (see packages/shared/src/
 * enums.ts — DealStageSchema); the API rejects anything else with a 400.
 * Its display labels (from data/constants.ts DEAL_STAGES) do NOT match the
 * raw PascalCase values — e.g. raw "NegotiationOralConfirmation" displays as
 * "Negotiation / Oral Confirmation" — so every `<select>`/Kanban-column/drag
 * target built from this list must submit the raw value via
 * DEAL_STAGE_VALUES, using DEAL_STAGE_LABELS only for the visible text.
 * These are also the Kanban board's columns, in pipeline order.
 */
export const DEAL_STAGE_VALUES = [
  "NewEnquiries",
  "NeedsAnalysis",
  "TrialsAndSampleTests",
  "ProposalsAndPriceQuote",
  "NegotiationOralConfirmation",
  "ClosedWon",
  "ClosedLost",
  "NoRequirementOrCold",
  "TrialProblem",
] as const;
export type DealStageValue = (typeof DEAL_STAGE_VALUES)[number];
export const DEAL_STAGE_LABELS: Record<DealStageValue, string> = {
  NewEnquiries: "New Enquiries",
  NeedsAnalysis: "Needs Analysis",
  TrialsAndSampleTests: "Trials & Sample Tests",
  ProposalsAndPriceQuote: "Proposals & Price Quote",
  NegotiationOralConfirmation: "Negotiation / Oral Confirmation",
  ClosedWon: "Closed Won",
  ClosedLost: "Closed Lost",
  NoRequirementOrCold: "No Requirement or Cold",
  TrialProblem: "Trial Problem",
};

/** Semantic tone for a deal-stage badge/column header, mirroring dealTone()
 * in data/constants.ts but operating on the raw DealStageValue instead of
 * the display label. */
export type DealStageTone = "won" | "hot" | "open" | "lost";
export function dealStageTone(s: DealStageValue | string): DealStageTone {
  if (s === "ClosedWon") return "won";
  if (s === "ClosedLost" || s === "NoRequirementOrCold") return "lost";
  if (s === "TrialProblem" || s === "NegotiationOralConfirmation" || s === "ProposalsAndPriceQuote") return "hot";
  return "open";
}

/**
 * `tier` (CustomerCategorySchema), `type` (CustomerTypeSchema) and `division`
 * (DivisionSchema) were checked against
 * their raw DB values in packages/shared/src/enums.ts and already match
 * exactly what a display label would show (e.g. "Platinum", "Existing",
 * "LUB") — so unlike `stage` above, they need no separate label→raw bridge;
 * each `<option value>` IS the raw value.
 */
export const CUSTOMER_CATEGORY_VALUES = ["Platinum", "Gold", "Silver", "Brass"] as const;
export type CustomerCategoryValue = (typeof CUSTOMER_CATEGORY_VALUES)[number];

export const CUSTOMER_TYPE_VALUES = ["Existing", "New"] as const;
export type CustomerTypeValue = (typeof CUSTOMER_TYPE_VALUES)[number];

export const DIVISION_VALUES = ["LUB", "WES"] as const;
export type DivisionValue = (typeof DIVISION_VALUES)[number];
