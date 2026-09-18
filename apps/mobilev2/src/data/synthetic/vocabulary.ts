/**
 * Word pools the synthetic generators compose names from.
 *
 * These are deliberately *parts*, not finished names. Company names are built
 * at generation time by combining a prefix with a trade and a suffix, so what
 * appears on screen is visibly assembled rather than a list of real-looking
 * businesses someone might mistake for the tenant's actual customers. That
 * mistake is exactly what this app is meant to avoid, so nothing in this file
 * should ever be copied from a real dataset.
 *
 * None of these values are business data. They never ship to a user: the
 * synthetic source is only reachable when the app is explicitly pointed at it.
 */

export const COMPANY_PREFIXES = [
  "Sample",
  "Demo",
  "Example",
  "Placeholder",
  "Specimen",
  "Trial",
  "Draft",
  "Mock",
] as const;

export const COMPANY_TRADES = [
  "Auto Works",
  "Machine Tools",
  "Metal Works",
  "Engineering",
  "Industries",
  "Fabricators",
  "Agencies",
  "Traders",
  "Enterprises",
  "Components",
  "Castings",
  "Bearings",
] as const;

export const COMPANY_SUFFIXES = ["", " Pvt Ltd", " & Co", " LLP"] as const;

/** Placeholder people. Initials render in the avatar, so keep two words. */
export const PERSON_FIRST = [
  "Sample",
  "Demo",
  "Example",
  "Test",
  "Placeholder",
  "Specimen",
] as const;

export const PERSON_LAST = [
  "Contact",
  "Person",
  "Buyer",
  "Manager",
  "Owner",
  "Lead",
] as const;

export const DESIGNATIONS = [
  "Purchase Manager",
  "Proprietor",
  "Plant Head",
  "Stores In-charge",
  "Managing Partner",
  "Production Manager",
  "Accounts Head",
] as const;

/** Area names are generic placeholders, not real localities. */
export const AREAS = [
  "North Zone",
  "South Zone",
  "East Zone",
  "West Zone",
  "Central Zone",
  "Industrial Estate A",
  "Industrial Estate B",
  "Outer Ring",
] as const;

export const INDUSTRIES = [
  "Automotive",
  "General Engineering",
  "Textiles",
  "Food Processing",
  "Pharmaceuticals",
  "Construction",
  "Packaging",
  "Electronics",
] as const;

export const SUB_INDUSTRIES = [
  "Tier 1",
  "Tier 2",
  "OEM",
  "Aftermarket",
  "Job Work",
] as const;

/** Principals (brands a distributor carries) — placeholder labels only. */
export const PRINCIPALS = [
  "Principal Alpha",
  "Principal Beta",
  "Principal Gamma",
  "Principal Delta",
] as const;

export const PRODUCT_LINES = [
  "Hydraulic Oil",
  "Gear Oil",
  "Cutting Fluid",
  "Grease",
  "Coolant",
  "Rust Preventive",
  "Way Lubricant",
  "Compressor Oil",
] as const;

export const PRODUCT_GRADES = [
  "Grade 32",
  "Grade 46",
  "Grade 68",
  "Grade 100",
  "Grade 150",
] as const;

export const PACK_SIZES = ["1 L", "5 L", "20 L", "26 L", "210 L"] as const;

export const OPPORTUNITY_THEMES = [
  "Annual rate contract",
  "New line trial",
  "Plant expansion supply",
  "Replacement enquiry",
  "Bulk repeat order",
  "Sample evaluation",
  "Consolidation of vendors",
  "Seasonal top-up",
] as const;

export const FOLLOW_UP_PURPOSES = [
  "Call and discuss proposal",
  "Site visit confirmation",
  "Share revised quotation",
  "Collect trial feedback",
  "Confirm dispatch schedule",
  "Discuss payment terms",
  "Review consumption data",
  "Introduce new grade",
] as const;

export const REMARK_NOTES = [
  "Awaiting confirmation from their purchase team.",
  "Trial batch consumed, feedback pending.",
  "Asked for a revised rate before committing.",
  "Wants delivery split across two dispatches.",
  "Budget approval expected next cycle.",
  "Comparing against an existing supplier.",
] as const;

export const ACTIVITY_KINDS = [
  "Call",
  "Visit",
  "Note",
  "Stage change",
  "Quotation",
  "Order",
] as const;
