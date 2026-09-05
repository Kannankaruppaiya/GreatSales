import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { ApiError } from "@/lib/api";

/**
 * Confirmation for an action that cannot be undone with a click.
 *
 * Every use states the CONSEQUENCE, not just the verb: "Ends all their
 * sessions immediately" tells an administrator something they might not have
 * known, where "Are you sure?" does not.
 */
export function ConfirmActionModal({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  destructive = false,
  pending = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  error?: unknown;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {destructive && <AlertTriangle className="h-4 w-4 text-red" />}
          <span>{title}</span>
        </div>
      }
      maxWidth="max-w-sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={onConfirm}
            // Disabled while in flight so a double click cannot fire the
            // action twice — for a delete, the second attempt would 404 and
            // show an error for something that actually succeeded.
            disabled={pending}
            className={destructive ? "bg-red hover:bg-red/90" : undefined}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-xs text-ink leading-relaxed">{body}</div>

      {!!error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-[11.5px] font-medium text-red"
        >
          {error instanceof ApiError
            ? error.message
            : "That did not work. Please try again."}
        </p>
      )}
    </Dialog>
  );
}
