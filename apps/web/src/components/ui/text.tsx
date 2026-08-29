/**
 * Text — binds a type-scale variant to a semantic color token, matching the
 * mobile scale exactly. Use a real heading element via `as` for hierarchy that
 * assistive tech can navigate.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type TextVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "bodyLg"
  | "body"
  | "bodySm"
  | "label"
  | "caption";

export type TextColor =
  | "primary"
  | "secondary"
  | "muted"
  | "onPrimary"
  | "link"
  | "success"
  | "warning"
  | "error";

type TextTag = "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4";

const VARIANT: Record<TextVariant, string> = {
  display: "text-[34px] leading-[40px] font-bold tracking-tight",
  h1: "text-[28px] leading-[34px] font-bold",
  h2: "text-[22px] leading-[28px] font-bold",
  h3: "text-[18px] leading-[24px] font-semibold",
  bodyLg: "text-[17px] leading-[25px]",
  body: "text-[15px] leading-[22px]",
  bodySm: "text-[13px] leading-[18px]",
  label: "text-[13px] leading-4 font-semibold tracking-wide",
  caption: "text-[12px] leading-4 font-medium",
};

const COLOR: Record<TextColor, string> = {
  primary: "text-fg",
  secondary: "text-fg-secondary",
  muted: "text-fg-muted",
  onPrimary: "text-on-primary",
  link: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

type TextProps = {
  children: ReactNode;
  variant?: TextVariant;
  color?: TextColor;
  as?: TextTag;
  className?: string;
};

export function Text({
  children,
  variant = "body",
  color = "primary",
  as: Tag = "span",
  className,
}: TextProps) {
  return <Tag className={cn(VARIANT[variant], COLOR[color], className)}>{children}</Tag>;
}
