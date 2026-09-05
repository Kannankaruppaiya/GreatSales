import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Building2, LayoutGrid, Loader2 } from "lucide-react";
import { useUi } from "@/store/ui";
import { useIsPlatformAuthed } from "@/store/platformAuth";
import {
  useManagements,
  openManagement,
  type ManagementSummary,
} from "@/features/management/queries";

/** Two-letter initials from a company name, for the compact list rows. */
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "M";

/**
 * Topbar management switcher — shown ONLY to a signed-in platform owner (a
 * tenant admin has no platform session, so it stays hidden for them). Switching
 * mints a fresh tenant session for the target via assume, then navigates.
 */
export function ManagementSwitcher() {
  const navigate = useNavigate();
  const isOwner = useIsPlatformAuthed();
  const activeManagementId = useUi((s) => s.activeManagementId);
  const { data: managements = [] } = useManagements();
  const [open, setOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  if (!isOwner) return null;

  const current = managements.find((m) => m.id === activeManagementId);

  const switchTo = async (m: ManagementSummary) => {
    setSwitchingTo(m.id);
    try {
      await openManagement(m.id);
      setOpen(false);
      navigate(`/managements/${m.id}/dashboard`);
    } finally {
      setSwitchingTo(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Switch management"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand/40 transition-colors"
      >
        <Building2 className="h-3.5 w-3.5 text-muted" />
        <span className="max-w-[140px] truncate">
          {current?.name ?? "Select management"}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-30 mt-1 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-xl text-xs">
            {managements
              .filter((m) => m.id !== activeManagementId)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-label={m.name}
                  disabled={switchingTo !== null}
                  onClick={() => switchTo(m)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ink hover:bg-surface-2 disabled:opacity-60"
                >
                  <span className="grid h-5 w-5 place-items-center rounded bg-brand-soft text-[10px] font-bold text-brand-ink">
                    {initials(m.name)}
                  </span>
                  <span className="flex-1 truncate">{m.name}</span>
                  {switchingTo === m.id && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted" />
                  )}
                </button>
              ))}
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              aria-label="Back to all managements"
              onClick={() => {
                setOpen(false);
                navigate("/managements");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-ink hover:bg-surface-2"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-muted" /> Back to all
              managements
            </button>
          </div>
        </>
      )}
    </div>
  );
}
