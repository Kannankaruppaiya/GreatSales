import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, ArrowRight, Sparkles } from "lucide-react";
import { useManagementStore } from "../store/managementStore";
import { CreateManagementModal } from "../components/modals/CreateManagementModal";

export default function ManagementHomePage() {
  const managements = useManagementStore((s) => s.managements);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const shown = managements.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="max-w-6xl mx-auto p-6 sm:p-10">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-emerald-800 text-white shadow-md shadow-brand/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Your managements</h1>
          <span className="text-sm text-muted font-semibold">{managements.length} workspaces</span>
          <div className="ml-auto flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-1.5">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search managements"
              className="bg-transparent text-sm outline-none text-ink placeholder:text-muted w-40"
            />
          </div>
        </div>

        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
          {shown.map((m) => (
            <Link
              key={m.id}
              to={`/managements/${m.id}/dashboard`}
              aria-label={m.name}
              className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3 hover:border-brand/40 transition-colors shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-ink font-extrabold text-sm">
                  {m.initials}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-ink truncate">{m.name}</div>
                  <div className="text-[11px] text-muted font-medium">
                    {m.industry || "—"} · {m.currency}
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-bold text-brand-ink flex items-center gap-1 mt-auto">
                Open <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-2xl border border-dashed border-line hover:border-brand/50 p-4 flex flex-col items-center justify-center gap-2 text-muted min-h-[140px] transition-colors"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-ink">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-[13px] font-bold text-ink">Create management</span>
            <span className="text-[11px] text-center">New workspace · own users &amp; data</span>
          </button>
        </div>
      </div>

      <CreateManagementModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
