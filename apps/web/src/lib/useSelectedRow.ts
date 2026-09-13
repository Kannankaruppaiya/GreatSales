import { useRef } from "react";

/**
 * The row an open detail modal is showing, addressed by id and read back out
 * of the live list.
 *
 * Pages used to hold the row OBJECT in state — `useState<OrderRow | null>` set
 * from the row that was clicked — and that is why saving inside a detail modal
 * needed a page refresh to show its own result. The mutation invalidated the
 * list, the list refetched, and the modal kept rendering the snapshot taken at
 * click time. Every such modal that wanted to stay correct had to copy the
 * mutation's response into a second piece of local state.
 *
 * Holding the id instead means the refetched row IS what the modal is handed.
 *
 * The `last` fallback covers the case that makes a naive lookup worse than the
 * bug: the lists these modals open from are filtered, so advancing an order
 * that is being viewed under a status chip drops it out of `rows` and would
 * slam the modal shut in the middle of the flow. A row that leaves the filter
 * keeps rendering from its last known value; only clearing the selection
 * closes the modal.
 */
export function useSelectedRow<T extends { id: string }>(
  rows: readonly T[],
  id: string | null,
): T | null {
  const last = useRef<T | null>(null);
  if (id === null) {
    last.current = null;
    return null;
  }
  const found = rows.find((r) => r.id === id);
  if (found) last.current = found;
  return last.current;
}
