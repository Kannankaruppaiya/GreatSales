import { useState } from "react";
import { Boxes } from "lucide-react";
import { Button, Dialog, Input } from "../ui";
import { useTrackerStore } from "../../store/trackerStore";

export function AddPrincipalModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addPrincipal, principals } = useTrackerStore();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().toUpperCase();
    if (!trimmed) return;
    if (principals.some((p) => p.name === trimmed)) {
      setError("A principal with this name already exists.");
      return;
    }
    addPrincipal(trimmed);
    setName("");
    setError("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-brand" />
          <span>Add Principal</span>
        </div>
      }
      description="Add a new principal brand / manufacturer"
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim()}>
            Add Principal
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {error && (
          <div className="rounded-lg bg-red-soft p-2.5 text-xs text-red font-medium border border-red/30">
            {error}
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Principal Name (e.g. CASTROL, WES, MOTUL) *
          </label>
          <Input
            required
            placeholder="Principal brand name…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </div>
      </form>
    </Dialog>
  );
}
