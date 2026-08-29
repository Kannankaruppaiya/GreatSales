/** Badge — compact status/label chip. The text carries meaning, not color. */
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "error";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-fg-secondary",
  primary: "bg-primary-subtle text-primary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  error: "bg-error-subtle text-error",
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
        TONE[tone],
      )}
    >
      {label}
    </span>
  );
}
