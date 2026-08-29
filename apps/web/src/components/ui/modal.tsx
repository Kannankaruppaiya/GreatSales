/**
 * Modal — an accessible dialog (role=dialog, aria-modal) rendered in a portal.
 * Closes on Escape and backdrop click, locks body scroll while open, moves
 * focus into the panel on open and restores it to the trigger on close. Use
 * only when the user must focus on one task (a form, a confirmation).
 */
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Text } from "@/components/ui/text";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Prevent closing (e.g. while a submit is in flight). */
  busy?: boolean;
};

export function Modal({ open, onClose, title, description, children, footer, busy }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = "modal-title";

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-[var(--overlay)]"
        onClick={() => !busy && onClose()}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-card bg-surface shadow-pop outline-none sm:rounded-card"
      >
        <div className="flex items-start justify-between gap-4 border-b border-divider p-5">
          <div className="min-w-0">
            <Text as="h2" variant="h3" >
              <span id={titleId}>{title}</span>
            </Text>
            {description ? (
              <Text variant="bodySm" color="secondary" className="mt-0.5 block">
                {description}
              </Text>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="-m-1 grid size-9 shrink-0 place-items-center rounded-field text-fg-muted hover:bg-surface-sunken hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

        {footer ? (
          <div className="flex justify-end gap-3 border-t border-divider p-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
