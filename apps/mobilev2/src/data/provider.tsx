/**
 * Hands the `DataSource` to the tree.
 *
 * Screens call `useData()` and get the API-backed source. Tests can wrap a
 * subtree in `<DataProvider source={...}>` with a fake that satisfies the same
 * interface.
 */
import React, { createContext, useContext, useMemo } from "react";

import { createApiSource } from "./api-source";
import type { MutableDataSource } from "./source";

const DataContext = createContext<MutableDataSource | null>(null);

export interface DataProviderProps {
  children: React.ReactNode;
  /** Override the source — used by tests. */
  source?: MutableDataSource;
}

export function DataProvider({ children, source }: DataProviderProps) {
  const value = useMemo(() => source ?? createApiSource(), [source]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): MutableDataSource {
  const source = useContext(DataContext);
  if (!source) throw new Error("useData must be used inside <DataProvider>");
  return source;
}

/** The write surface. The same object as `useData()`; kept for call-site clarity. */
export function useMutableData(): MutableDataSource {
  return useData();
}
