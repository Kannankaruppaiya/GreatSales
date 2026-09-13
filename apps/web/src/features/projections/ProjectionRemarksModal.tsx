import { Dialog } from "@/components/ui";
import { RemarksPanel } from "@/features/remarks/RemarksPanel";

/**
 * The activity notes on one worksheet line, reachable from the line.
 *
 * The notes were already stored against the projection (`/remarks` with
 * entityType `Projection`) and already rendered — but only inside the
 * follow-up modal, read-only, below a form. So logging a note meant filling in
 * a follow-up, and reading the history of a line meant opening a dialog whose
 * purpose was something else. The POC gives the row its own Remarks button with
 * a count on it; this is that button's destination.
 */
export function ProjectionRemarksModal({
  open,
  onClose,
  title,
  subtitle,
  projectionId,
  canWrite,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  projectionId: string;
  canWrite: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={subtitle}
      maxWidth="max-w-lg"
    >
      <RemarksPanel
        entityType="Projection"
        entityId={projectionId}
        enabled={open}
        canWrite={canWrite}
      />
    </Dialog>
  );
}
