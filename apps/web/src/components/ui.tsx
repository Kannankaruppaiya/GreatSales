import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../lib/utils";

/* ---------------- Button (shadcn/ui style with active tactile feedback) ---------------- */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-ink shadow-sm hover:shadow hover:shadow-brand/20",
        secondary: "bg-surface border border-line text-ink hover:bg-surface-2 hover:border-muted/30 shadow-xs",
        soft: "bg-brand-soft text-brand-ink hover:bg-brand-soft/80 font-semibold border border-brand/20",
        outline: "border border-line bg-surface text-ink hover:bg-surface-2 hover:border-muted/40",
        ghost: "text-muted hover:bg-surface-2 hover:text-ink",
        danger: "bg-red text-white hover:bg-red/90 shadow-sm",
        dangerOutline: "border border-red/30 text-red bg-red-soft/30 hover:bg-red-soft/70",
      },
      size: {
        xs: "h-7 px-2.5 text-xs rounded-md",
        sm: "h-8 px-3 text-[13px] rounded-md",
        md: "h-9 px-3.5 text-sm rounded-lg",
        lg: "h-10 px-5 text-base rounded-lg",
        icon: "h-8 w-8 p-0 rounded-md",
        iconSm: "h-7 w-7 p-0 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

/* ---------------- Card ---------------- */
export function Card({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "interactive" | "elevated" | "accent";
}) {
  const variantStyles = {
    default: "border border-line bg-surface shadow-card",
    interactive: "border border-line bg-surface shadow-card hover:shadow-card-hover hover:border-brand/30 transition-all cursor-pointer",
    elevated: "border border-line bg-surface shadow-md",
    accent: "border-t-2 border-t-brand border-x border-b border-line bg-surface shadow-card",
  }[variant];

  return (
    <div
      className={cn("rounded-xl transition-all", variantStyles, className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  hint,
  action,
  className,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line px-5 py-3.5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-bold text-ink tracking-tight font-sans">{title}</div>
        {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- Inputs ---------------- */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/50 transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-2 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-surface p-3 text-sm text-ink placeholder:text-muted/50 transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-2",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function Select({
  className,
  selectClassName,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { selectClassName?: string }) {
  return (
    <div className={cn("relative inline-block", className)}>
      <select
        className={cn(
          "h-full w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-7 text-[12.5px] text-ink font-medium transition-all hover:border-muted/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-2 cursor-pointer shadow-xs",
          selectClassName,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/* ---------------- Badge (shadcn/ui style with accessible contrast) ---------------- */
export function Badge({
  children,
  variant = "default",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "brand" | "good" | "warn" | "bad" | "info" | "purple" | "outline";
  dot?: boolean;
  className?: string;
}) {
  const styles = {
    default: "bg-surface-2 text-ink-2 border-line",
    brand: "bg-brand-soft text-brand-ink border-brand/25",
    good: "bg-brand-soft text-brand-ink border-brand/30",
    warn: "bg-amber-soft text-amber border-amber/30",
    bad: "bg-red-soft text-red border-red/30",
    info: "bg-blue-soft text-blue border-blue/30",
    purple: "bg-violet-soft text-violet border-violet/30",
    outline: "border-line text-muted bg-transparent",
  }[variant];

  const dotColors = {
    default: "bg-muted",
    brand: "bg-brand",
    good: "bg-emerald-600",
    warn: "bg-amber-600",
    bad: "bg-red-600",
    info: "bg-blue-600",
    purple: "bg-violet-600",
    outline: "bg-muted",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight transition-colors whitespace-nowrap select-none",
        styles,
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", dotColors)} />}
      {children}
    </span>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const init = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink shadow-xs border border-brand/20 select-none",
        className,
      )}
    >
      {init}
    </div>
  );
}

/* ---------------- Segmented Tabs (shadcn/ui style) ---------------- */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { value: T; label: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }[];
  active: T;
  onChange: (val: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center rounded-lg border border-line bg-surface-2 p-1 text-muted", className)}>
      {tabs.map((t) => {
        const isSel = t.value === active;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none",
              isSel
                ? "bg-surface text-ink shadow-xs border border-line/70"
                : "hover:text-ink hover:bg-surface/50",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- PageHeader ---------------- */
export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2", className)}>
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-sans">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-xs sm:text-[13px] text-muted mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

/* ---------------- Tremor Metric Card ---------------- */
export function MetricCard({
  title,
  value,
  subvalue,
  delta,
  deltaType = "neutral",
  icon: Icon,
  accentColor = "brand",
  onClick,
}: {
  title: string;
  value: string;
  subvalue?: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "warning" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
  accentColor?: "brand" | "amber" | "red" | "blue" | "violet";
  onClick?: () => void;
}) {
  const accentBorders = {
    brand: "hover:border-brand/40 group-hover:text-brand",
    amber: "hover:border-amber/40 group-hover:text-amber",
    red: "hover:border-red/40 group-hover:text-red",
    blue: "hover:border-blue/40 group-hover:text-blue",
    violet: "hover:border-violet/40 group-hover:text-violet",
  }[accentColor];

  const deltaStyles = {
    positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
    negative: "bg-rose-50 text-rose-700 border-rose-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    neutral: "bg-slate-50 text-slate-700 border-slate-200",
  }[deltaType];

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-line bg-surface p-4.5 shadow-card transition-all",
        onClick && "cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5",
        accentBorders,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted font-sans">{title}</span>
        {Icon && (
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-muted border border-line/60 transition-colors group-hover:bg-brand-soft group-hover:text-brand">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <div className="text-2xl font-bold tracking-tight text-ink tabular-nums font-sans">{value}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>{subvalue}</span>
          {delta && (
            <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border", deltaStyles)}>
              {deltaType === "positive" && <TrendingUp className="h-3 w-3" />}
              {deltaType === "negative" && <TrendingDown className="h-3 w-3" />}
              {deltaType === "neutral" && <Minus className="h-3 w-3" />}
              {delta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Dialog / Modal (shadcn/ui style) ---------------- */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      {/* Full-screen Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-150"
        onClick={onClose}
      />
      {/* Centered Modal Content box */}
      <div
        className={cn(
          "relative z-50 my-auto flex max-h-[88vh] w-full flex-col rounded-2xl border border-line bg-surface shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden",
          maxWidth,
        )}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-line px-6 py-4 bg-surface-2/80">
          <div className="min-w-0 pr-4">
            <h3 className="text-base font-bold text-ink tracking-tight font-sans">{title}</h3>
            {description && <p className="text-xs text-muted mt-0.5 leading-normal font-medium">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink border border-transparent hover:border-line transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">{children}</div>

        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-line bg-surface-2/80 px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Skeleton Loading Indicator ---------------- */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-3/70", className)}
      {...props}
    />
  );
}

/* ---------------- FormField with Label, Required Indicator & Error Message ---------------- */
export function FormField({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label?: React.ReactNode;
  required?: boolean;
  error?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-xs font-bold text-ink flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-red font-black" title="Required field">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <div className="text-[11px] text-muted">{hint}</div>}
      {error && (
        <div className="text-[11.5px] font-medium text-red animate-in fade-in flex items-center gap-1">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Empty State ---------------- */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-12 px-4 text-center space-y-3 flex flex-col items-center justify-center", className)}>
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 border border-line text-muted shadow-2xs">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <h4 className="font-bold text-sm text-ink">{title}</h4>
        {description && <p className="text-xs text-muted leading-relaxed">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
