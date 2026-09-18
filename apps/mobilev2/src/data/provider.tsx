/**
 * Hands the chosen `DataSource` to the tree.
 *
 * Screens call `useData()` and get whichever source `config.ts` selected. Tests
 * can wrap a subtree in `<DataProvider source={...}>` with a fixed seed and get
 * byte-identical rows.
 */
import React, { createContext, useContext, useMemo } from "react";

import { DATA_SOURCE, SYNTHETIC_LATENCY_MS, SYNTHETIC_SEED } from "./config";
import type { DataSource, MutableDataSource } from "./source";
import { isMutable } from "./source";
import { createSyntheticSource } from "./synthetic-source";

const DataContext = createContext<DataSource | null>(null);

export interface DataProviderProps {
  children: React.ReactNode;
  /** Override the configured source — used by tests and by the dev menu. */
  source?: DataSource;
}

function createConfiguredSource(): DataSource {
  if (DATA_SOURCE === "api") {
    // Deliberately loaded lazily so the synthetic build never pulls in the
    // HTTP client, and so a missing API base URL fails here rather than on the
    // first screen that happens to fetch.
    const { createApiSource } = require("./api-source") as typeof import("./api-source");
    return createApiSource();
  }
  return createSyntheticSource({
    seed: SYNTHETIC_SEED,
    latencyMs: SYNTHETIC_LATENCY_MS,
  });
}

export function DataProvider({ children, source }: DataProviderProps) {
  // Built once: the synthetic source holds the generated dataset, and
  // rebuilding it on every render would discard anything the user just created.
  const value = useMemo(() => source ?? createConfiguredSource(), [source]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataSource {
  const source = useContext(DataContext);
  if (!source) throw new Error("useData must be used inside <DataProvider>");
  return source;
}

/**
 * The write surface, for screens that create or edit.
 *
 * Throws rather than returning null: a create screen that renders without a
 * way to save is worse than one that fails loudly during development.
 */
export function useMutableData(): MutableDataSource {
  const source = useData();
  if (!isMutable(source)) {
    throw new Error(
      `The ${source.kind} data source is read-only; this screen needs a writable one.`,
    );
  }
  return source;
}

/** True when the rows on screen are generated, not real. Drives the dev banner. */
export function useIsSynthetic(): boolean {
  return useData().kind === "synthetic";
}
