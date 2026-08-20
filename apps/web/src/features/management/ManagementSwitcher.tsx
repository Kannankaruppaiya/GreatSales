import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Building2, LayoutGrid } from "lucide-react";
import { useUi } from "@/store/ui";
import { useManagementStore } from "@/features/management/managementStore";
import { useIsOwner } from "@/store/auth";

export function ManagementSwitcher() {
  const isOwner = useIsOwner();
  const activeManagementId = useUi((s) => s.activeManagementId);
  const managements = useManagementStore((s) => s.managements);
  const [open, setOpen] = useState(false);

  if (!isOwner) return null;
  const current = managements.find((m) => m.id === activeManagementId);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Switch management"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand/40 transition-colors"
      >
        <Building2 className="h-3.5 w-3.5 text-muted" />
        <span className="max-w-[140px] truncate">{current?.name ?? "Select management"}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-30 mt-1 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-xl text-xs">
            {managements
              .filter((m) => m.id !== activeManagementId)
              .map((m) => (
                <Link
                  key={m.id}
                  to={`/managements/${m.id}/dashboard`}
                  aria-label={m.name}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-ink hover:bg-surface-2"
                >
                  <span className="grid h-5 w-5 place-items-center rounded bg-brand-soft text-[10px] font-bold text-brand-ink">
                    {m.initials}
                  </span>
                  <span className="truncate">{m.name}</span>
                </Link>
              ))}
            <div className="my-1 border-t border-line" />
            <Link
              to="/managements"
              aria-label="Back to all managements"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-ink hover:bg-surface-2"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-muted" /> Back to all managements
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
