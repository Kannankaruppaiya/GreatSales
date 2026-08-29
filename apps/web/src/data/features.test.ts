import { describe, expect, it } from "vitest";
import { FEATURES, featureLabel, featuresFor, featurePath } from "./features";

// The registry only means anything if every entry has a route behind it. This
// reads App.tsx as text rather than rendering it: the pages are lazy, and the
// question here is whether the two lists agree, not whether they render.
import APP_TSX from "../App.tsx?raw";

describe("feature registry", () => {
  it("has a route in App.tsx for every feature", () => {
    for (const f of FEATURES) {
      expect(APP_TSX, `no <Route path="${f.key}"> in App.tsx`).toContain(
        `path="${f.key}"`,
      );
    }
  });

  it("gives every feature at least one role and a unique key", () => {
    for (const f of FEATURES) {
      expect(f.roles.length, `${f.key} is reachable by nobody`).toBeGreaterThan(0);
    }
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(FEATURES.length);
  });

  it("gates admin-only surfaces away from sales and management", () => {
    const salesKeys = featuresFor("sales").map((f) => f.key);
    expect(salesKeys).not.toContain("users");
    expect(salesKeys).not.toContain("data");
    expect(salesKeys).not.toContain("products");
    expect(featuresFor("mgmt").map((f) => f.key)).not.toContain("users");
  });

  it("shows sales the ownership-scoped labels", () => {
    const customers = FEATURES.find((f) => f.key === "customers")!;
    expect(featureLabel(customers, "sales")).toBe("My Customers");
    expect(featureLabel(customers, "admin")).toBe("Customers");
  });

  it("builds workspace-scoped paths, not bare ones", () => {
    expect(featurePath("leads", "m1")).toBe("/managements/m1/leads");
  });
});
