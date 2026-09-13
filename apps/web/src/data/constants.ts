/* Domain vocabulary — mirrors the POC spec so screens speak the same
 * language the business already uses. */

/** Web login roles. All four roles have a web login; `sales` is additionally
 *  the primary role on the GreatSales mobile app. */
export type Role = "super_admin" | "admin" | "mgmt" | "sales";

export const ROLES: { value: Role; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Administrator" },
  { value: "mgmt", label: "Management" },
  { value: "sales", label: "Salesperson" },
];

export const roleLabel = (r: Role) =>
  ROLES.find((x) => x.value === r)?.label ?? "Administrator";

/*
 * MONTHS used to live here: a hardcoded Apr 2026 – Mar 2027 fiscal window that
 * would have expired in April 2027, could not reach any month before it, and
 * was used as a lookup table for labels. Months are generated from the calendar
 * now — see data/months.ts.
 */

/** Recurring projection line statuses. */
export const PROJ_STATUSES = [
  "Projection Created",
  "Follow-up Pending",
  "Customer Interested",
  "Waiting Approval",
  "PO Expected",
  "PO Received",
  "Order Placed",
  "Partially Confirmed",
  "Confirmed",
  "Completed",
  "Deferred to Next Month",
  "Lost",
  "Cancelled",
] as const;
export type ProjStatus = (typeof PROJ_STATUSES)[number];

/** New-sales pipeline stages (9 stages). */
export const DEAL_STAGES = [
  "New Enquiries",
  "Needs Analysis",
  "Trials & Sample Tests",
  "Proposals & Price Quote",
  "Negotiation / Oral Confirmation",
  "Closed Won",
  "Closed Lost",
  "No Requirement or Cold",
  "Trial Problem",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

/** Sales-order lifecycle (6 stages + Cancelled). */
export const SO_STATUSES = [
  "Created",
  "Acknowledged",
  "Delivery Partner Assigned",
  "Delivered from Warehouse",
  "Delivered to Customer",
  "Customer Receipt Confirmed",
  "Cancelled",
] as const;
export type SoStatus = (typeof SO_STATUSES)[number];

export const PAYMENT_TERMS = [
  "Immediate",
  "15 Days Credit",
  "30 Days Credit",
  "45 Days Credit",
  "Cash on Delivery",
  "Advance 50% + Balance Delivery",
  "100% Advance Payment",
] as const;

export const DELIVERY_MODES = [
  "Transport (LR)",
  "Courier",
  "Company Vehicle",
  "Customer Pickup",
  "Hand Delivery",
] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const PAY_ZONES = [
  "Green Zone",
  "Yellow Zone",
  "Red Zone",
  "Blacklist",
] as const;
export type PayZone = (typeof PAY_ZONES)[number];

export const CUSTOMER_TIERS = ["Platinum", "Gold", "Silver", "Brass"] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const DIVISIONS = ["LUB", "WES"] as const;
export type Division = (typeof DIVISIONS)[number];

export const INDUSTRIAL_AREAS = [
  "Ambattur",
  "Guindy",
  "Sriperumbudur",
  "Oragadam",
  "Maraimalai Nagar",
  "Irungattukottai",
  "Thirumudivakkam",
  "Gummidipoondi",
  "Red Hills",
  "Hosur",
  "Coimbatore",
  "Other",
] as const;

export const INDUSTRY_TAXONOMY: Record<string, string[]> = {
  "Automotive & Auto Components": [
    "OEM Vehicle Assembly",
    "Tier-1 Engine & Transmission",
    "Tier-2 Stamping & Fasteners",
    "Auto Electricals & Electronics",
    "Brake Systems & Suspension",
    "Aftermarket & Spares",
  ],
  "General Engineering & Machining": [
    "CNC Machining & Turning",
    "VMC & Precision Job Work",
    "Tool Room & Die Making",
    "Fabrication & Structural Works",
    "Hydraulic & Pneumatic Systems",
    "Pumps, Valves & Actuators",
  ],
  "Foundry, Forging & Metallurgy": [
    "Die Casting (HPDC / LPDC)",
    "Grey & Ductile Iron Foundry",
    "Steel Forging & Extrusion",
    "Aluminium Smelting & Ingot",
    "Heat Treatment & Hardening",
  ],
  "Surface Treatment & Coating": [
    "Powder Coating & Electrostatic",
    "Electroplating (Zinc / Chrome / Nickel)",
    "Anodizing & Passivation",
    "Shot Blasting & Sand Blasting",
    "Phosphating & CED Coating",
    "Industrial Painting & Spray",
  ],
  "Plastics, Polymers & Rubber": [
    "Plastic Injection Moulding",
    "Blow Moulding & Extrusion",
    "Rubber Moulding & Tyre Spares",
    "Mould & Die Manufacturing",
  ],
  "Electrical, Electronics & Energy": [
    "Transformer & Switchgear",
    "Motor & Pump Assembly",
    "Cables, Wiring & Harness",
    "Solar & Renewable Equipment",
    "Control Panels & Automation",
  ],
  "Heavy Machinery, Infra & Construction": [
    "Earthmoving & Mining Spares",
    "Crane & Material Handling",
    "Boiler, Pressure Vessel & Process Equipment",
    "Pre-Engineered Building (PEB)",
  ],
  "Process & Packaging Industries": [
    "Pharmaceutical Machining",
    "Food & Dairy Processing Equipment",
    "Printing & Packaging Machinery",
    "Textile Machinery & Spares",
  ],
  "Other / Unclassified": [
    "Trading & Supply Agency",
    "Facility Maintenance & Services",
    "Miscellaneous Manufacturing",
  ],
};

/* --- Semantic tone mapping (drives StatusBadge colours) --- */
export type Tone = "won" | "hot" | "open" | "lost" | "neutral";

/** Sensible default win-confidence per projection status (0–100). Used when a
 * line has no explicit probability so the weighted pipeline still means something. */
export function defaultProbability(s: string): number {
  switch (s) {
    case "Confirmed":
    case "Completed":
      return 100;
    case "PO Received":
    case "Order Placed":
      return 95;
    case "Partially Confirmed":
      return 80;
    case "PO Expected":
      return 70;
    case "Waiting Approval":
      return 55;
    case "Customer Interested":
      return 40;
    case "Follow-up Pending":
      return 25;
    case "Projection Created":
      return 15;
    case "Deferred to Next Month":
      return 10;
    case "Lost":
    case "Cancelled":
      return 0;
    default:
      return 20;
  }
}

/** Colour band for a confidence %, reusing the semantic tone vocabulary. */
export function probabilityTone(p: number): Tone {
  if (p >= 80) return "won";
  if (p >= 50) return "hot";
  if (p >= 25) return "open";
  return "lost";
}

export function projTone(s: string): Tone {
  if (s === "Confirmed" || s === "Completed") return "won";
  if (["Partially Confirmed", "PO Expected", "Waiting Approval", "PO Received", "Order Placed"].includes(s)) return "hot";
  if (s === "Lost" || s === "Cancelled") return "lost";
  return "open";
}

export function dealTone(s: string): Tone {
  if (s === "Closed Won") return "won";
  if (["Closed Lost", "No Requirement or Cold"].includes(s)) return "lost";
  if (["Trial Problem", "Negotiation / Oral Confirmation", "Proposals & Price Quote"].includes(s))
    return "hot";
  return "open";
}

export function soTone(s: string): Tone {
  if (s === "Cancelled") return "lost";
  if (s === "Customer Receipt Confirmed") return "won";
  if (s === "Created") return "open";
  return "hot";
}

export function zoneTone(z: string): Tone {
  if (z === "Green Zone") return "won";
  if (z === "Yellow Zone") return "hot";
  if (z === "Red Zone" || z === "Blacklist") return "lost";
  return "neutral";
}

/**
 * Colour band for an invoice's payment status. Keyed on the display label, the
 * same convention as the tone helpers above, so the payments table can hand
 * `StatusBadge` a tone instead of hand-rolling its own badge classes.
 */
export function payTone(s: string): Tone {
  if (s === "Paid") return "won";
  if (s === "Partially Paid") return "hot";
  if (s === "Overdue") return "lost";
  return "open";
}
