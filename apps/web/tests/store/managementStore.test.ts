import { describe, it, expect, beforeEach } from "vitest";
import { useManagementStore, emptyDataset } from "../../src/store/managementStore";
import { DEFAULT_MANAGEMENT_ID } from "../../src/store/ui";

const baseState = () => ({
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
});

describe("useManagementStore", () => {
  beforeEach(() => useManagementStore.setState(baseState()));

  it("seeds the default management", () => {
    expect(useManagementStore.getState().managements[0].id).toBe(DEFAULT_MANAGEMENT_ID);
  });

  it("createManagement appends a summary and an empty dataset", () => {
    const id = useManagementStore.getState().createManagement({
      name: "Acme Traders",
      industry: "Pharma",
      currency: "INR (₹)",
      timezone: "Asia/Kolkata",
      adminName: "Ravi",
      adminEmail: "ravi@acme.com",
    });
    const s = useManagementStore.getState();
    expect(s.managements.map((m) => m.id)).toContain(id);
    expect(s.datasets[id].customers).toEqual([]);
    expect(s.datasets[id].users).toHaveLength(1);
    expect(s.datasets[id].users[0].email).toBe("ravi@acme.com");
  });

  it("save/getDataset round-trips", () => {
    const data = emptyDataset({
      name: "X",
      subdomain: "x",
      currency: "INR (₹)",
      fiscalYearStart: "April",
    });
    useManagementStore.getState().saveDataset("m_x", data);
    expect(useManagementStore.getState().getDataset("m_x")).toEqual(data);
  });
});
