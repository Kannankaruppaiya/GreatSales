/**
 * Input — labelled text field. The label is a real <label> (never
 * placeholder-as-label), required is marked in text, errors are announced
 * (role=alert) and reinforced with an icon, and inputs are linked to their
 * help/error via aria-describedby. Password fields get a show/hide toggle.
 */
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> & {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  secure?: boolean;
};

export function Input({
  label,
  error,
  helper,
  required,
  secure,
  type = "text",
  disabled,
  ...rest
}: InputProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
  const [reveal, setReveal] = useState(false);

  const inputType = secure ? (reveal ? "text" : "password") : type;

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
          "flex items-center rounded-field border bg-input-bg px-3 transition-colors",
          "focus-within:ring-2 focus-within:ring-focus focus-within:border-focus",
          error ? "border-error" : "border-border",
          disabled && "bg-disabled-bg",
        )}
      >
        <input
          id={id}
          type={inputType}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-12 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-muted disabled:cursor-not-allowed"
          {...rest}
        />
        {secure ? (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="ml-2 grid size-8 place-items-center rounded text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        ) : null}
      </div>

      {error ? (
        <div id={`${id}-error`} role="alert" className="flex items-center gap-1.5">
          <AlertCircle className="size-3.5 shrink-0 text-error" aria-hidden />
          <Text variant="bodySm" color="error">
            {error}
          </Text>
        </div>
      ) : helper ? (
        <Text variant="bodySm" color="muted">
          <span id={`${id}-helper`}>{helper}</span>
        </Text>
      ) : null}
    </div>
  );
}
