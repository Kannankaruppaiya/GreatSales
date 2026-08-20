import type { ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { Skeleton } from "@/components/ui";

interface Props {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyLabel?: string;
  children: ReactNode;
}

/**
 * Shared loading/error/empty boundary for react-query-backed pages. Renders a
 * skeleton while loading, an inline error card on failure (using the server's
 * message when the error is an {@link ApiError}), an empty-state message when
 * the query succeeded with zero rows, or `children` otherwise.
 */
export function QueryBoundary({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyLabel = "No records yet.",
  children,
}: Props) {
  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (isError) {
    const msg = error instanceof ApiError ? error.message : "Something went wrong.";
    return (
      <div className="rounded-xl border border-red/30 bg-red-soft p-4 text-xs font-medium text-red">
        Failed to load: {msg}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-xs text-muted">
        {emptyLabel}
      </div>
    );
  }
  return <>{children}</>;
}
