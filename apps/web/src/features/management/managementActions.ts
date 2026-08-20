import { useTrackerStore } from "@/store/trackerStore";
import { useManagementStore, emptyDataset, type TrackerData } from "@/features/management/managementStore";
import { useUi } from "@/store/ui";

export function snapshotTracker(): TrackerData {
  const t = useTrackerStore.getState();
  return {
    users: t.users,
    principals: t.principals,
    products: t.products,
    customers: t.customers,
    projections: t.projections,
    leads: t.leads,
    orders: t.orders,
    payments: t.payments,
    profile: t.profile,
  };
}

export function switchManagement(targetId: string): void {
  const current = useUi.getState().activeManagementId;
  if (current && current !== targetId) {
    useManagementStore.getState().saveDataset(current, snapshotTracker());
  }
  const target =
    useManagementStore.getState().getDataset(targetId) ??
    emptyDataset(snapshotTracker().profile);
  useTrackerStore.setState({ ...target });
  useUi.getState().setActiveManagement(targetId);
}
