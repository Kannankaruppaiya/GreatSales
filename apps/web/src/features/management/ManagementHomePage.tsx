import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Plus,
  Search,
  Users,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  LogOut,
  Loader2,
} from "lucide-react";
import { usePlatformAuth, usePlatformUser } from "@/store/platformAuth";
import { useManagements, openManagement } from "@/features/management/queries";
import { CreateManagementModal } from "@/features/management/CreateManagementModal";
import { lakhs } from "@/lib/format";

/** Two-letter initials from a company name. */
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "M";

const STATUS_TONE: Record<string, string> = {
  Active: "bg-green-soft text-green-ink",
  Trial: "bg-amber-soft text-amber-ink",
  Suspended: "bg-red-soft text-red-ink",
  Churned: "bg-surface-2 text-muted",
};

/**
 * Level 0 — the owner's management (tenant) grid. One card per company; opening
 * one mints a tenant session via assume and drops into the existing admin.
 * This is the real replacement for the localStorage mock: every card is a row
 * from GET /platform/managements, and there is no cross-company analytics here
 * (that is deliberately out of scope — a management's numbers live inside it).
 */
export default function ManagementHomePage() {
  const navigate = useNavigate();
  const platformUser = usePlatformUser();
  const logout = usePlatformAuth((s) => s.logout);
  const { data: managements = [], isLoading, isError, refetch } = useManagements();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return managements;
    return managements.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.industry ?? "").toLowerCase().includes(q) ||
        (m.region ?? "").toLowerCase().includes(q),
    );
  }, [managements, search]);

  const open = async (id: string) => {
    setOpeningId(id);
    try {
      await openManagement(id);
      navigate(`/managements/${id}/dashboard`);
    } finally {
      setOpeningId(null);
    }
  };

  const signOut = () => {
    logout();
    navigate("/platform/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-brand-ink">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <div>
              <h1 className="text-sm font-bold leading-tight">Managements</h1>
              <p className="text-[11px] text-muted">
                {platformUser
                  ? `${platformUser.name} · ${platformUser.role}`
                  : "Owner console"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-ink hover:border-brand/40"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              aria-label="Search managements"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 pl-8 text-sm font-medium text-ink"
            />
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted">Loading managements…</p>
        ) : isError ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <p className="text-sm font-semibold text-ink">
              Couldn’t load managements.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-label={m.name}
                disabled={openingId !== null}
                onClick={() => open(m.id)}
                className="group flex flex-col rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand/50 disabled:opacity-60"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-sm font-bold text-brand-ink">
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {m.name}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {[m.industry, m.region].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      STATUS_TONE[m.status] ?? "bg-surface-2 text-muted"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {m.userCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />{" "}
                    {lakhs(m.salesThisMonth)}
                  </span>
                  <span className="ml-auto flex items-center gap-1 font-bold text-brand-ink opacity-0 transition-opacity group-hover:opacity-100">
                    {openingId === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </span>
                </div>
              </button>
            ))}

            {/* Create card */}
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface/50 p-4 text-muted transition-colors hover:border-brand/50 hover:text-brand-ink"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm font-bold">Create management</span>
            </button>

            {filtered.length === 0 && search === "" && (
              <p className="col-span-full mt-2 text-center text-sm text-muted">
                No managements yet. Create your first company to get started.
              </p>
            )}
            {filtered.length === 0 && search !== "" && (
              <p className="col-span-full mt-2 text-center text-sm text-muted">
                No managements match “{search}”.
              </p>
            )}
          </div>
        )}

        <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted">
          <Building2 className="h-3.5 w-3.5" />
          Opening a company signs you in as its administrator.
        </p>
      </main>

      <CreateManagementModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
