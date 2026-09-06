import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button, Dialog, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import { useCreatePrincipal } from "@/features/products/queries";

export function AddPrincipalModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreatePrincipal();
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isDirty = name.trim().length > 0;

  const handleAttemptClose = () => {
    if (isDirty && !create.isPending) {
      setShowDiscardConfirm(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setShowDiscardConfirm(false);
    setName("");
    setErrorMessage("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().toUpperCase();
    if (!trimmed || create.isPending) return;

    try {
      setErrorMessage("");
      await create.mutateAsync({ name: trimmed });
      handleForceClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to create principal. Please try again.");
      }
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleAttemptClose}
        title="Add Principal Brand"
        description="Register a new principal brand / manufacturer into your catalog master data."
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAttemptClose}
              type="button"
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Registering…
                </>
              ) : (
                "Add Principal"
              )}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg bg-red-soft/80 border border-red/30 p-2.5 text-xs text-red font-medium flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="principal-brand-name"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Principal Brand Name <span className="text-red">*</span>
            </label>
            <Input
              id="principal-brand-name"
              required
              autoFocus
              placeholder="e.g. CASTROL, MOTUL, WES, SHELL"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              className="uppercase font-medium"
              disabled={create.isPending}
            />
            <p className="mt-1.5 text-[11px] text-muted">
              Brand names are automatically standardized in uppercase across your organization.
            </p>
          </div>
        </form>
      </Dialog>

      <ConfirmActionModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Principal Brand Changes?"
        body="You have entered a brand name that has not been saved yet. Are you sure you want to discard your changes?"
        confirmLabel="Discard Changes"
        destructive
        onConfirm={handleForceClose}
      />
    </>
  );
}

