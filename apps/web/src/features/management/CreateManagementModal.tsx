import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, KeyRound } from "lucide-react";
import {
  useCreateManagement,
  openManagement,
  type CreateManagementResponse,
} from "@/features/management/queries";
import { ApiError } from "@/lib/api";

const CURRENCIES = ["INR (₹)", "USD ($)", "GBP (£)", "EUR (€)"];

export function CreateManagementModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const create = useCreateManagement();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [currency, setCurrency] = useState("INR (₹)");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreateManagementResponse | null>(null);
  const [opening, setOpening] = useState(false);

  if (!open) return null;

  const close = () => {
    setCreated(null);
    setError("");
    onClose();
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Enter a company name");
      return;
    }
    if (!adminEmail.trim()) {
      setError("Enter the first admin's email");
      return;
    }
    setError("");
    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        industry: industry.trim() || null,
        currency,
        timezone: timezone.trim() || null,
        adminName: adminName.trim() || "Admin",
        adminEmail: adminEmail.trim(),
      });
      setCreated(res);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not create the management. Please try again.",
      );
    }
  };

  const openNew = async () => {
    if (!created) return;
    setOpening(true);
    try {
      await openManagement(created.management.id);
      close();
      navigate(`/managements/${created.management.id}/dashboard`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {created ? (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink">
              {created.management.name} is ready
            </h2>
            <p className="text-xs text-muted">
              Share these one-time credentials with the first admin. They must
              change the password on first sign-in. This password is shown once.
            </p>
            <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
              <div className="flex items-center gap-2 text-muted text-xs font-bold">
                <KeyRound className="h-3.5 w-3.5" /> First admin
              </div>
              <p className="mt-1 font-medium text-ink">{created.adminEmail}</p>
              <p className="mt-1 font-mono text-sm font-bold text-ink break-all">
                {created.tempPassword}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={close}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold text-ink"
              >
                Close
              </button>
              <button
                onClick={openNew}
                disabled={opening}
                className="flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {opening && <Loader2 className="h-4 w-4 animate-spin" />}
                Open management
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-ink">Create management</h2>

            <label className="block text-xs font-bold text-muted">
              Company name
              <input
                aria-label="Company name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
              />
            </label>

            <label className="block text-xs font-bold text-muted">
              Industry
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-muted">
                Currency
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-muted">
                Timezone
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
                />
              </label>
            </div>

            <label className="block text-xs font-bold text-muted">
              First admin name
              <input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
              />
            </label>

            <label className="block text-xs font-bold text-muted">
              First admin email
              <input
                aria-label="First admin email"
                value={adminEmail}
                onChange={(e) => {
                  setAdminEmail(e.target.value);
                  setError("");
                }}
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
              />
            </label>

            {error && <p className="text-xs font-semibold text-red">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={close}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold text-ink"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={create.isPending}
                className="flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {create.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Create management
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
