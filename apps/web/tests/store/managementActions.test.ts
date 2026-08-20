import { describe, it, expect, beforeEach } from "vitest";
import { switchManagement, snapshotTracker } from "@/features/management/managementActions";
import { useTrackerStore } from "@/store/trackerStore";
import { useManagementStore, emptyDataset } from "@/features/management/managementStore";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";

describe("switchManagement", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID });
    useManagementStore.setState({
      managements: [
        {
          id: DEFAULT_MANAGEMENT_ID,
          name: "Default",
          initials: "DF",
          industry: "x",
          currency: "INR (₹)",
          createdAt: "2026-08-19",
        },
      ],
      datasets: {
        m_empty: emptyDataset({
          name: "Empty Co",
          subdomain: "m_empty",
          currency: "INR (₹)",
          fiscalYearStart: "April",
        }),
      },
    });
  });

  it("saves the current dataset and loads the target", () => {
    const before = useTrackerStore.getState().customers.length;
    expect(before).toBeGreaterThan(0);

    switchManagement("m_empty");
    expect(useUi.getState().activeManagementId).toBe("m_empty");
    expect(useTrackerStore.getState().customers).toEqual([]);
    expect(
      useManagementStore.getState().getDataset(DEFAULT_MANAGEMENT_ID)!.customers.length,
    ).toBe(before);

    switchManagement(DEFAULT_MANAGEMENT_ID);
    expect(useTrackerStore.getState().customers.length).toBe(before);
  });

  it("snapshotTracker captures live tracker arrays", () => {
    const snap = snapshotTracker();
    expect(snap.customers).toEqual(useTrackerStore.getState().customers);
    expect(snap.profile).toEqual(useTrackerStore.getState().profile);
  });
});
