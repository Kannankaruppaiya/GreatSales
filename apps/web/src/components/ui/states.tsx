/**
 * Loading / Empty / Error state views. Every data region renders one of these
 * instead of a blank area or a bare spinner. Error offers a Retry.
 */
import { CloudOff, Loader2, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-40 flex-col items-center justify-center gap-3 py-10"
    >
      <Loader2 className="size-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
      <Text variant="bodySm" color="muted">
        {label}
      </Text>
    </div>
  );
}

type MessageStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "error";
};

function MessageState({ icon: Icon, title, description, actionLabel, onAction, tone = "neutral" }: MessageStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div
        className={cn(
          "grid size-16 place-items-center rounded-full",
          tone === "error" ? "bg-error-subtle" : "bg-surface-sunken",
        )}
      >
        <Icon className={cn("size-7", tone === "error" ? "text-error" : "text-fg-muted")} aria-hidden />
      </div>
      <Text variant="h3" as="h2">
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="secondary" className="max-w-sm">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant={tone === "error" ? "primary" : "secondary"} onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState(props: Omit<MessageStateProps, "tone">) {
  return <MessageState {...props} tone="neutral" />;
}

export function ErrorState({
  title = "Something needs another try",
  description = "We couldn’t load this. Check your connection and try again.",
  onRetry,
  icon = CloudOff,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <MessageState
      icon={icon}
      title={title}
      description={description}
      actionLabel={onRetry ? "Try again" : undefined}
      onAction={onRetry}
      tone="error"
    />
  );
}
