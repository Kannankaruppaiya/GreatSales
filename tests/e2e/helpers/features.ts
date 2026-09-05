import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The feature registry, read out of apps/web/src/data/features.ts at run time.
 *
 * Importing the module itself would drag in lucide-react and the "@/" alias,
 * neither of which Playwright resolves, so the entries are parsed from source.
 * Either way the tests stay derived from the one place a feature is declared —
 * add a page there and it is covered here on the next run.
 */
export type RegistryFeature = {
  key: string;
  title: string;
  roles: string[];
};

const SOURCE = resolve(__dirname, "../../../apps/web/src/data/features.ts");

const ALL_ROLES = ["super_admin", "admin", "mgmt", "sales"];

function parse(): RegistryFeature[] {
  const src = readFileSync(SOURCE, "utf8");
  const body = src.slice(src.indexOf("export const FEATURES"));
  const entry = /key:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?roles:\s*(\[[^\]]*\]|ALL_ROLES)/g;

  const out: RegistryFeature[] = [];
  for (const m of body.matchAll(entry)) {
    const roles = m[3] === "ALL_ROLES" ? ALL_ROLES : [...m[3].matchAll(/"([^"]+)"/g)].map((r) => r[1]);
    out.push({ key: m[1], title: m[2], roles });
  }

  if (out.length === 0) throw new Error(`No features parsed from ${SOURCE}`);
  return out;
}

export const FEATURES = parse();

export const featuresFor = (role: string) => FEATURES.filter((f) => f.roles.includes(role));
