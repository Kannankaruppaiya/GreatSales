/**
 * Button — the single action primitive. Variants encode hierarchy (at most one
 * primary per view). Loading blocks double-submit; disabled/busy are reflected
 * to assistive tech; focus is always visible.
 */
import { Loader2, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "md" | "lg";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: LucideIcon;
  className?: string;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-pressed active:bg-primary-pressed border border-transparent",
  secondary:
    "bg-surface text-fg border border-border hover:bg-surface-sunken active:bg-surface-sunken",
  tertiary: "bg-transparent text-primary border border-transparent hover:bg-surface-sunken",
  destructive: "bg-error text-on-primary hover:brightness-95 active:brightness-90 border border-transparent",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  leadingIcon: LeadingIcon,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-field font-semibold select-none",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        "focus-visible:ring-offset-canvas",
        size === "lg" ? "h-12 px-5 text-[16px]" : "h-11 px-4 text-[15px]",
        fullWidth && "w-full",
        isDisabled
          ? "cursor-not-allowed bg-disabled-bg text-disabled-fg border border-transparent"
          : VARIANT[variant],
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-[18px] animate-spin" />
      ) : LeadingIcon ? (
        <LeadingIcon aria-hidden className="size-[18px]" />
      ) : null}
      {children}
    </button>
  );
}
