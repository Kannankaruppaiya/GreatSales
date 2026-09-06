import { useEffect, useState } from "react";
import { Button, Dialog, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import { DeleteAction } from "@/components/modals/DeleteAction";
import {
  useDeletePrincipal,
  useUpdatePrincipal,
} from "@/features/products/queries";
import type { PrincipalRow } from "@/features/products/types";

/**
 * Rename or remove a principal brand.
 *
 * `PATCH` and `DELETE /principals/:id` shipped with the catalog and had react-
 * query hooks written for them, but nothing ever called either: a brand could
 * be created and then never corrected, so a typo in a principal name was
 * permanent. Delete is refused by the API while products still reference the
 * brand, and that refusal is shown rather than pre-empted — the count on screen
 * can be stale, and the server's answer is the true one.
 */
export function EditPrincipalModal({
  open,
  onClose,
  principal,
}: {
  open: boolean;
  onClose: () => void;
  principal: PrincipalRow | null;
}) {
  const update = useUpdatePrincipal();
  const del = useDeletePrincipal();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    if (open && principal) {
      setName(principal.name);
      setError("");
      setShowDiscardConfirm(false);
    }
  }, [open, principal?.id, principal?.updatedAt]);

  if (!principal) return null;

  const isDirty = name.trim() !== principal.name && name.trim().length > 0;

  const handleAttemptClose = () => {
    if (isDirty && !update.isPending) {
      setShowDiscardConfirm(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setShowDiscardConfirm(false);
    setName(principal.name);
    setError("");
    onClose();
  };

  const handleSave = async () => {
    if (!isDirty) return;
    setError("");
    try {
      await update.mutateAsync({ id: principal.id, patch: { name: name.trim() } });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename the brand.");
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleAttemptClose}
        title="Edit Principal Brand"
        description="Rename the brand, or remove it once no products reference it."
        maxWidth="max-w-sm"
        footer={
          <>
            <DeleteAction
              label="Delete Brand"
              title={`Delete ${principal.name}?`}
              body={
                <>
                  The brand is removed from the catalog. This is refused while any
                  product still belongs to it — reassign those products first.
                  {(principal.productCount ?? 0) > 0 && (
                    <>
                      {" "}
                      <strong>
                        {principal.productCount} product
                        {principal.productCount === 1 ? "" : "s"}
                      </strong>{" "}
                      currently reference it.
                    </>
                  )}
                </>
              }
              onDelete={() => del.mutateAsync(principal.id)}
              onDeleted={onClose}
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleAttemptClose}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={handleSave}
              disabled={!isDirty || update.isPending}
            >
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-xs">
          <label className="block font-bold text-ink" htmlFor="principal-name">
            Brand name
          </label>
          <Input
            id="principal-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shell Lubricants"
            disabled={update.isPending}
          />
          {error && <p role="alert" className="text-[11.5px] font-medium text-red">{error}</p>}
        </div>
      </Dialog>

      <ConfirmActionModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Principal Changes?"
        body="You have unsaved changes to this brand name. Are you sure you want to discard your changes?"
        confirmLabel="Discard Changes"
        destructive
        onConfirm={handleForceClose}
      />
    </>
  );
}

