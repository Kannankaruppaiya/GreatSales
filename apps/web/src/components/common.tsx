import { Search } from "lucide-react";
import { cn } from "../lib/utils";
import { Card } from "./ui";

/* ---------------- Page header ---------------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[19px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------- KPI tile ---------------- */
export function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
  accent?: React.ReactNode;
}) {
  const bar = {
    neutral: "bg-line",
    good: "bg-brand",
    warn: "bg-amber",
    bad: "bg-red",
  }[tone];
  const valTone = {
    neutral: "text-ink",
    good: "text-brand-ink",
    warn: "text-amber",
    bad: "text-red",
  }[tone];
  return (
    <Card className="relative overflow-hidden p-4">
      <div className={cn("absolute inset-y-0 left-0 w-1", bar)} />
      <div className="flex items-start justify-between">
        <div className="text-[12px] font-medium uppercase tracking-wide text-faint">{label}</div>
        {accent}
      </div>
      <div className={cn("mt-2 text-[26px] font-bold leading-none tabular-nums", valTone)}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-muted">{sub}</div>}
    </Card>
  );
}

/* ---------------- Search box ---------------- */
export function SearchBox({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9.5 w-full rounded-[--radius-sm] border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
      />
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {Icon && (
        <div className="grid h-11 w-11 place-items-center rounded-full bg-line-2 text-faint">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="text-sm font-semibold text-ink-2">{title}</div>
      {hint && <div className="max-w-xs text-[12.5px] text-faint">{hint}</div>}
    </div>
  );
}

/* ---------------- Table shell ---------------- */
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-[13px]", className)}>{children}</table>
    </div>
  );
}
export function Th({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-[1] border-b border-line bg-surface-2 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}
export function Td({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "border-b border-line-2 px-3 py-2.5 text-ink-2",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}
export function Tr({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn("transition-colors hover:bg-surface-2", onClick && "cursor-pointer", className)}
    >
      {children}
    </tr>
  );
}
