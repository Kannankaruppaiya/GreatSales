import { useId, useMemo, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Password entry with a strength meter, a reveal toggle, and a generator.
 *
 * The client-side checks here are ADVISORY. The authoritative policy lives on
 * the server (`packages/shared/src/password.ts`), and its WEAK_PASSWORD
 * message is rendered verbatim on submit. The web app is deliberately
 * decoupled from the shared package's CJS dist, so importing the real
 * validator is not an option — but the direction of the mismatch is safe: this
 * only ever warns EARLIER than the server would, never later. Nothing here can
 * tell a user a password is acceptable and then have the server take it.
 */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/** Ambiguous glyphs are excluded so a generated password can be read aloud. */
const GENERATOR_ALPHABET =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_.";

/**
 * Generates a password using the platform CSPRNG.
 *
 * `crypto.getRandomValues`, never `Math.random`: this value becomes a real
 * credential the moment an administrator hands it over, and Math.random is
 * seeded predictably enough to reconstruct.
 *
 * Rejection sampling on the byte range keeps the distribution uniform — a
 * plain modulo would bias toward the first few characters of the alphabet.
 */
export function generatePassword(length = 20): string {
  const alphabet = GENERATOR_ALPHABET;
  const limit = 256 - (256 % alphabet.length);
  const out: string[] = [];
  const buffer = new Uint8Array(length * 2);

  while (out.length < length) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (out.length === length) break;
      if (byte < limit) out.push(alphabet[byte % alphabet.length]);
    }
  }
  return out.join("");
}

/** Coarse 0-4 score for the meter only — never a gate. */
export function passwordStrength(plain: string): 0 | 1 | 2 | 3 | 4 {
  if (!plain) return 0;
  let score = 0;
  if (plain.length >= PASSWORD_MIN) score++;
  if (plain.length >= 16) score++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(plain),
  ).length;
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABEL = ["", "Very weak", "Weak", "Good", "Strong"] as const;
const STRENGTH_CLASS = [
  "bg-line",
  "bg-red",
  "bg-amber-500",
  "bg-brand/70",
  "bg-brand",
] as const;

/**
 * Advisory client-side reason, or null when nothing is obviously wrong.
 * Mirrors the server's rules; the server still has the final say.
 */
export function advisoryPasswordProblem(
  value: string,
  identity: { name?: string; email?: string; username?: string },
): string | null {
  if (!value) return null;
  if (value.length < PASSWORD_MIN)
    return `Must be at least ${PASSWORD_MIN} characters.`;
  if (new TextEncoder().encode(value).length > PASSWORD_MAX)
    return `Must be at most ${PASSWORD_MAX} bytes.`;

  const lower = value.toLowerCase();
  const fragments = [
    ...(identity.name?.split(/[^\p{L}\p{N}]+/u) ?? []),
    identity.username ?? "",
    identity.email?.split("@")[0] ?? "",
  ]
    .map((f) => f.trim().toLowerCase())
    .filter((f) => f.length >= 4);

  if (fragments.some((f) => lower.includes(f)))
    return "Must not contain the name, email, or username.";
  return null;
}

export function PasswordField({
  value,
  onChange,
  identity,
  required = false,
  label = "Password",
  helpText,
  serverError,
}: {
  value: string;
  onChange: (next: string) => void;
  identity: { name?: string; email?: string; username?: string };
  required?: boolean;
  label?: string;
  helpText?: string;
  /** The server's authoritative message, shown in place of the advisory one. */
  serverError?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  const strength = useMemo(() => passwordStrength(value), [value]);
  const advisory = useMemo(
    () => advisoryPasswordProblem(value, identity),
    [value, identity],
  );
  const problem = serverError ?? advisory;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
      >
        {label} {required && <span aria-hidden="true">*</span>}
      </label>

      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Input
            id={inputId}
            type={revealed ? "text" : "password"}
            value={value}
            required={required}
            aria-describedby={hintId}
            aria-invalid={!!problem}
            onChange={(e) => onChange(e.target.value)}
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onChange(generatePassword());
            // Revealed on generate: an administrator cannot hand over a
            // credential they were never shown.
            setRevealed(true);
          }}
          className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-[11px] font-semibold text-ink hover:bg-surface cursor-pointer inline-flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" /> Generate
        </button>
      </div>

      {value && (
        <div className="mt-1.5 flex items-center gap-2">
          <div
            className="h-1 flex-1 rounded-full bg-line overflow-hidden"
            role="presentation"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                STRENGTH_CLASS[strength],
              )}
              style={{ width: `${(strength / 4) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-muted w-16">
            {STRENGTH_LABEL[strength]}
          </span>
        </div>
      )}

      <p
        id={hintId}
        className={cn(
          "text-[11px] mt-1",
          problem ? "text-red font-medium" : "text-muted",
        )}
        // Announced so a screen-reader user learns the password was rejected
        // without having to re-read the field.
        role={problem ? "alert" : undefined}
      >
        {problem ??
          helpText ??
          `At least ${PASSWORD_MIN} characters. Avoid the person's name, email, or username.`}
      </p>
    </div>
  );
}
