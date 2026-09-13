import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSelectedRow } from "../../src/lib/useSelectedRow";

type Row = { id: string; status: string };

describe("useSelectedRow", () => {
  it("hands back the row as it currently stands in the list", () => {
    const { result, rerender } = renderHook(
      ({ rows }: { rows: Row[] }) => useSelectedRow(rows, "a"),
      { initialProps: { rows: [{ id: "a", status: "Created" }] } },
    );
    expect(result.current?.status).toBe("Created");

    // What a mutation + refetch looks like from the page's side. Before this
    // hook, the modal kept rendering "Created" until the operator pressed F5.
    rerender({ rows: [{ id: "a", status: "Acknowledged" }] });
    expect(result.current?.status).toBe("Acknowledged");
  });

  it("keeps rendering a row that a filter has dropped", () => {
    const { result, rerender } = renderHook(
      ({ rows }: { rows: Row[] }) => useSelectedRow(rows, "a"),
      { initialProps: { rows: [{ id: "a", status: "Created" }] } },
    );
    // Advancing an order while the list is filtered to "Created" removes it
    // from `rows`. Closing the modal mid-flow would be worse than the bug.
    rerender({ rows: [] });
    expect(result.current?.id).toBe("a");
  });

  it("is null once the selection is cleared, and forgets the old row", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) =>
        useSelectedRow([{ id: "a", status: "Created" }] as Row[], id),
      { initialProps: { id: "a" as string | null } },
    );
    rerender({ id: null });
    expect(result.current).toBeNull();
    rerender({ id: "missing" });
    expect(result.current).toBeNull();
  });
});
