import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  resolveRange,
  todayIso,
  type Granularity,
  type PeriodRange,
} from "@/data/periodRange";

/**
 * The reporting window, as a GRANULARITY and an ANCHOR — one date inside it.
 *
 * It used to be a single `YYYY-MM`, which is why the topbar could only offer
 * months. The pair is stored rather than the resolved `from`/`to` dates: "this
 * month" has to still mean this month tomorrow, and a stored range would
 * silently become last month's in a tab left open overnight.
 *
 * Before this, the value was a hardcoded `"2026-08"`, with two problems and the
 * second the serious one:
 *
 *   1. The app defaulted to one fixed month forever, so every user would open
 *      on August 2026 for the rest of the product's life.
 *   2. `store/ui.ts` is imported by `App.tsx`, `layout.tsx` and
 *      `DashboardPage.tsx`, so that one string pulled a mock module — and
 *      through it a large dataset — into the production bundle.
 */

/**
 * The window is SESSION state, not a saved preference.
 *
 * It used to be persisted with the rest of this store, so a user who looked at
 * June once opened the app in June for the rest of the year — every page,
 * every reload, until they noticed. The app must open on the real current
 * month every time; looking at another one is an act, and acts do not outlive
 * the tab. Selecting a past window still works, and still holds while you move
 * between pages, because the value lives in this store for the session.
 */
const SESSION_ONLY: (keyof UiState)[] = ["granularity", "anchor"];

/** The pre-existing seeded company — the default management every session opens with.
 *  Value is a human-readable slug (matches the slug of "GreatSales Industrial Corp"). */
export const DEFAULT_MANAGEMENT_ID = "greatsales-industrial-corp";

/* Client UI preferences only. Session/auth now lives in `useAuth` (store/auth.ts). */
interface UiState {
  activeManagementId: string | null;
  granularity: Granularity;
  /** `YYYY-MM-DD` — any day inside the window. */
  anchor: string;
  principalId: string;
  ownerFilter: string;
  sidebarOpen: boolean;
  setActiveManagement: (id: string | null) => void;
  setPeriod: (granularity: Granularity, anchor: string) => void;
  /**
   * Kept for the worksheet-shaped pages — projections, data, the management
   * home — which are per-month by their data model and pick with a month
   * dropdown. Setting a month is setting a month-granularity window, so there
   * is one selection in the store rather than two that can disagree.
   */
  setMonth: (m: string) => void;
  setPrincipal: (id: string) => void;
  setOwnerFilter: (id: string) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      activeManagementId: DEFAULT_MANAGEMENT_ID,
      granularity: "month",
      anchor: todayIso(),
      principalId: "ALL",
      ownerFilter: "ALL",
      sidebarOpen: true,
      setActiveManagement: (activeManagementId) => set({ activeManagementId }),
      setPeriod: (granularity, anchor) => set({ granularity, anchor }),
      // `YYYY-MM` in, a month window out. The first of the month is an anchor
      // like any other day in it.
      setMonth: (m) => set({ granularity: "month", anchor: `${m}-01` }),
      setPrincipal: (principalId) => set({ principalId }),
      setOwnerFilter: (ownerFilter) => set({ ownerFilter }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "greatsales_ui_state",
      version: 9,
      // Only the durable preferences are written. The window is omitted on
      // purpose — see SESSION_ONLY.
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([k]) => !SESSION_ONLY.includes(k as keyof UiState),
          ),
        ) as UiState,
      // v6→v7: auth fields (authed/role/isOwner/ownerId) moved out to useAuth.
      // Drop any legacy keys so an old blob can't rehydrate a fake session.
      // v7→v8: `month` stopped being persisted. A stored one is IGNORED rather
      // than restored, which is the whole point of the version bump — every
      // existing install is carrying a stale month right now.
      // v8→v9: `month` became a granularity + anchor pair. A stored `month` is
      // dropped rather than translated, for the same reason: it is stale.
      // Returns the same partialized shape `partialize` writes, so both halves
      // of the persist contract describe one type rather than two.
      migrate: (persistedState: unknown): UiState => {
        // Only the four keys read below are trusted off the stored blob; every
        // other field is recomputed, so a legacy shape cannot smuggle one in.
        const base = (persistedState ?? {}) as Partial<
          Pick<
            UiState,
            "activeManagementId" | "principalId" | "ownerFilter" | "sidebarOpen"
          >
        >;
        return {
          activeManagementId: base.activeManagementId ?? DEFAULT_MANAGEMENT_ID,
          granularity: "month" as Granularity,
          anchor: todayIso(),
          principalId: base.principalId ?? "ALL",
          ownerFilter: base.ownerFilter ?? "ALL",
          sidebarOpen: base.sidebarOpen ?? true,
        } as UiState;
      },
    },
  ),
);

/**
 * The window, resolved.
 *
 * Derived on read rather than stored, so a tab left open overnight moves with
 * the calendar instead of quietly reporting yesterday as today.
 */
export const usePeriodRange = (): PeriodRange => {
  const granularity = useUi((s) => s.granularity);
  const anchor = useUi((s) => s.anchor);
  return resolveRange(granularity, anchor);
};

/**
 * The window's month, `YYYY-MM`.
 *
 * For the worksheet-shaped pages: a projection worksheet IS a month, so a week
 * window still opens the month that contains it. One selection, two readings —
 * rather than a second piece of state that can drift from the first.
 */
export const useMonth = (): string => useUi((s) => s.anchor.slice(0, 7));
