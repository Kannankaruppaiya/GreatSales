/**
 * Select — a labelled native <select> (native for accessibility + platform
 * pickers). Same label/error/helper structure as Input. Options are
 * {value,label}; an optional placeholder becomes a disabled empty option.
 */
import { ChevronDown } from "lucide-react";
import { useId, type SelectHTMLAttributes } from "react";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id"> & {
  label: string;
  options: SelectOption[];
  error?: string;
  helper?: string;
  required?: boolean;
  placeholder?: string;
};

export function Select({
  label,
  options,
  error,
  helper,
  required,
  placeholder,
  disabled,
  value,
  ...rest
}: SelectProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-0.5">
        <Text variant="label" color="secondary">
          {label}
        </Text>
        {required ? (
          <span className="text-[13px] font-semibold text-error" aria-hidden>
            *
          </span>
        ) : null}
      </label>

      <div
        className={cn(
          "relative flex items-center rounded-field border bg-input-bg transition-colors",
          "focus-within:ring-2 focus-within:ring-focus focus-within:border-focus",
          error ? "border-error" : "border-border",
          disabled && "bg-disabled-bg",
        )}
      >
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-12 w-full appearance-none bg-transparent px-3 pr-9 text-[15px] text-fg outline-none disabled:cursor-not-allowed"
          {...rest}
        >
          {placeholder !== undefined ? (
            <option value="">{placeholder}</option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 size-4 text-fg-muted"
          aria-hidden
        />
      </div>

      {error ? (
        <Text variant="bodySm" color="error">
          <span id={`${id}-error`} role="alert">
            {error}
          </span>
        </Text>
      ) : helper ? (
        <Text variant="bodySm" color="muted">
          <span id={`${id}-helper`}>{helper}</span>
        </Text>
      ) : null}
    </div>
  );
}
