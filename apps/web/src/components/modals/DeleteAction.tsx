import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import { ApiError } from "@/lib/api";

/**
 * A destructive button and its confirmation, as one thing.
 *
 * Four detail modals needed the same twenty lines — button, open state, error
 * state, try/catch, ConfirmActionModal — for deletes whose API endpoints and
 * react-query hooks already existed but which no UI ever called. Keeping that
 * in one place is also what keeps the CONSEQUENCE wording honest: every caller
 * has to pass a `body` saying what is lost, because there is no default.
 *
 * `onDeleted` runs only after the mutation resolves, so a caller can close its
 * parent modal without racing the request.
 */
export function DeleteAction({
  label,
  title,
  body,
  onDelete,
  onDeleted,
  disabled = false,
  className,
}: {
  /** Button text, e.g. "Delete Lead". */
  label: string;
  /** Confirmation heading. */
  title: string;
  /** What is lost. Not "Are you sure?". */
  body: React.ReactNode;
  onDelete: () => Promise<unknown>;
  onDeleted?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  const confirm = async () => {
    setPending(true);
    setError(undefined);
    try {
      await onDelete();
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err : new Error("Delete failed."));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
        className={
          className ?? "text-red border-red/30 hover:bg-red-soft mr-auto"
        }
      >
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        {label}
      </Button>

      <ConfirmActionModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void confirm()}
        title={title}
        body={body}
        confirmLabel={label}
        destructive
        pending={pending}
        error={error}
      />
    </>
  );
}
