import { useUi } from "./store/ui";
import type { Filters } from "./data/selectors";

/** Bridge the UI store into the shape selectors expect. */
export function useFilters(): Filters {
  const { role, ownerId, principalId, ownerFilter } = useUi();
  return { role, ownerId, principalId, ownerFilter };
}
