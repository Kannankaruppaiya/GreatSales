import { useUi } from "./store/ui";
import { useAuthRole } from "./store/auth";
import { useMockOwnerId } from "./lib/mockOwner";
import type { Filters } from "./data/selectors";

/** Bridge the UI store into the shape selectors expect. */
export function useFilters(): Filters {
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const { principalId, ownerFilter } = useUi();
  return { role, ownerId, principalId, ownerFilter };
}
