import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useManagementStore } from "../../store/managementStore";

const CURRENCIES = ["INR (₹)", "USD ($)", "GBP (£)", "EUR (€)"];

export function CreateManagementModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const createManagement = useManagementStore((s) => s.createManagement);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [currency, setCurrency] = useState("INR (₹)");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = () => {
    if (!name.trim()) {
      setError("Enter a company name");
      return;
    }
    const id = createManagement({ name: name.trim(), industry, currency, timezone, adminName, adminEmail });
    onClose();
    navigate(`/managements/${id}/dashboard`);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
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
        {error && <p className="text-xs text-red">{error}</p>}

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
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold text-ink">
            Cancel
          </button>
          <button onClick={submit} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white">
            Create management
          </button>
        </div>
      </div>
    </div>
  );
}
