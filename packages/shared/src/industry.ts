import { z } from "zod";

/**
 * Industry (global reference catalogue) contracts, shared by the API and web.
 *
 * Unlike the tenant-owned entities, `Industry` is a shared, non-tenant-scoped
 * table every tenant reads (see the `lock_global_reference_tables` migration:
 * the runtime role has SELECT only). The endpoint is therefore read-only — a
 * single `GET /industries` that backs every industry picker (add-customer,
 * add-lead) so those pickers no longer scrape options out of already-loaded
 * rows. That scraping is what left the dashboard's quick-add-lead modal with an
 * empty industry list once it stopped loading leads (checklists/03-API.md
 * C.3.12).
 */

/** One industry option. `subIndustries` is the flat list of specializations. */
export interface IndustryOption {
  id: string;
  name: string;
  subIndustries: string[];
}

/** GET /industries response — the full catalogue, ordered by name. */
export type IndustryListResponse = IndustryOption[];

/** Runtime guard for the JSON `subIndustries` column (defaults to `[]`). */
export const SubIndustriesSchema = z.array(z.string());
