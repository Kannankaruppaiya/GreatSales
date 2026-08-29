/**
 * Banner — inline status message. Status is conveyed by icon + text, never
 * color alone. Optional single recovery action. Announced via role=alert.
 */
import { AlertCircle, CheckCircle2, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type BannerTone = "info" | "success" | "warning" | "error";

type BannerProps = {
  tone?: BannerTone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const ICON: Record<BannerTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};

const TONE: Record<BannerTone, { bg: string; border: string; icon: string }> = {
  info: { bg: "bg-info-subtle", border: "border-l-info", icon: "text-info" },
  success: { bg: "bg-success-subtle", border: "border-l-success", icon: "text-success" },
  warning: { bg: "bg-warning-subtle", border: "border-l-warning", icon: "text-warning" },
  error: { bg: "bg-error-subtle", border: "border-l-error", icon: "text-error" },
};

export function Banner({ tone = "info", title, message, actionLabel, onAction }: BannerProps) {
  const Icon = ICON[tone];
  const t = TONE[tone];

  return (
    <div role="alert" className={cn("rounded-field border-l-[3px] p-3", t.bg, t.border)}>
      <div className="flex gap-2.5">
        <Icon className={cn("mt-px size-[18px] shrink-0", t.icon)} aria-hidden />
        <div className="flex flex-1 flex-col gap-0.5">
          {title ? (
            <Text variant="label" color="primary">
              {title}
            </Text>
          ) : null}
          <Text variant="bodySm" color="primary">
            {message}
          </Text>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className={cn(
                "mt-1 self-start text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded",
                t.icon,
              )}
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
