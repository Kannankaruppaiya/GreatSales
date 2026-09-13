import { useEffect, useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { DateField } from "@/components/DateField";

/**
 * Sets one date on one worksheet line — the next follow-up, or the expected
 * closure.
 *
 * The POC edits both dates directly in their table cells with a native date
 * box. A date in this app is entered as day / month / year dropdowns, which is
 * three controls and far wider than a table column, so the cell stays a
 * one-click target that shows the date and this opens over it. Same reach as
 * the POC — the date is set from the row, without leaving it — with the date
 * control this app uses everywhere else.
 */
export function ProjectionDateModal({
  open,
  onClose,
  title,
  subtitle,
  fieldLabel,
  value,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  /** What this date is, for the field's own label and assistive tech. */
  fieldLabel: string;
  /** `YYYY-MM-DD`, or null when unset. */
  value: string | null;
  onSave: (next: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");

  // Re-seed when the modal is opened on a different line, so it never shows the
  // previous row's date.
  useEffect(() => {
    if (open) setDraft(value ?? "");
  }, [open, value]);

  const save = () => {
    onSave(draft || null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={subtitle}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          {/* Clearing is a real answer: a line whose follow-up is done should
              be able to have no next date rather than a stale one. */}
          {value && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                onSave(null);
                onClose();
              }}
            >
              Clear date
            </Button>
          )}
          <Button size="sm" type="button" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <label
          htmlFor="proj-date"
          className="block text-xs font-semibold uppercase tracking-wider text-muted"
        >
          {fieldLabel}
        </label>
        <DateField id="proj-date" label={fieldLabel} value={draft} onChange={setDraft} />
      </div>
    </Dialog>
  );
}
