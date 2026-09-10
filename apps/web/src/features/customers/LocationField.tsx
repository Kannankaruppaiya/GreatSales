import { useState } from "react";
import { MapPin, Share2, Check, Crosshair, X } from "lucide-react";
import { Button } from "@/components/ui";

export interface Pin {
  latitude: number;
  longitude: number;
  locationAccuracyM: number | null;
}

/**
 * Build the shareable link. Mirrors `mapsUrl` in @greatsales/shared, which the
 * Vite build does not consume (see ./types.ts for why the wire types are
 * copied here too).
 */
export function mapsUrl(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const trim = (n: number) => String(Number(n.toFixed(7)));
  return `https://www.google.com/maps?q=${trim(latitude)},${trim(longitude)}`;
}

/**
 * Hand a customer's location to whoever asked for it.
 *
 * `navigator.share` is the good path on a phone or tablet — it opens WhatsApp
 * and the rest directly. On the desktops most of this console runs on there is
 * no share sheet, so the link goes to the clipboard instead. Clipboard writes
 * are themselves refusable (permission, or a non-secure origin), and a Share
 * button that silently does nothing is worse than one that admits it could
 * not, so every outcome is reported back rather than thrown away.
 */
export async function shareLocationUrl(
  url: string,
  label: string,
): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ text: `${label}\n${url}`, url });
      return "shared";
    } catch {
      // Cancelled, or this payload is unsupported — copying still works.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/**
 * Pin a customer's location from the browser, and hand it to whoever asks.
 *
 * The field pin is taken on the phone, standing at the customer's gate. This
 * exists for the desk half of the job: someone on a call with a driver needs
 * the link in their clipboard now, and someone correcting a wrong pin for an
 * office that IS the customer's address can take it here.
 */
export function LocationField({
  value,
  accuracyM,
  pinnedAt,
  pinnedByName,
  customerName,
  onChange,
  disabled,
  readOnly,
}: {
  value: { latitude: number; longitude: number } | null;
  accuracyM?: number | null;
  pinnedAt?: string | null;
  pinnedByName?: string | null;
  customerName?: string;
  onChange: (pin: Pin | null) => void;
  disabled?: boolean;
  /**
   * The workspace has location tracking switched off, but this account already
   * carries a pin. Everything stays visible and Clear stays live — removing
   * what is stored is usually the reason the feature was switched off — while
   * pinning a new one is not offered.
   */
  readOnly?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = mapsUrl(value?.latitude, value?.longitude);

  const capture = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("This browser cannot report a location.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          locationAccuracyM:
            pos.coords.accuracy == null ? null : Math.round(pos.coords.accuracy),
        });
      },
      (e) => {
        setBusy(false);
        // Each case has a different fix, and "location unavailable" for all
        // three would send people to the wrong one.
        setError(
          e.code === e.PERMISSION_DENIED
            ? "Location permission was blocked. Allow it for this site in your browser's address bar, then try again."
            : e.code === e.POSITION_UNAVAILABLE
              ? "No location fix available on this device. A phone at the customer's place will do better."
              : "Getting the location took too long. Try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const share = async () => {
    if (!url) return;
    const result = await shareLocationUrl(
      url,
      customerName ? `${customerName} — location` : "Customer location",
    );
    if (result === "failed") {
      setError('Could not copy the link. Use "Open map" and copy it from the address bar.');
      return;
    }
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="rounded-lg border border-brand/20 bg-brand-soft px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Location pinned
          </div>
          <div className="mt-0.5 text-xs text-ink">
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            {accuracyM != null ? ` · ±${accuracyM}m` : ""}
          </div>
          {pinnedAt ? (
            <div className="text-[11px] text-muted">
              {new Date(pinnedAt).toLocaleDateString()}
              {pinnedByName ? ` · ${pinnedByName}` : ""}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted">
          {readOnly
            ? "Location tracking is switched off for this workspace."
            : "No location pinned. The salesperson pins this from the mobile app at the customer's place."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!readOnly && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={capture}
            disabled={disabled || busy}
          >
            <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? "Getting location…" : value ? "Re-pin here" : "Use my location"}
          </Button>
        )}
        {url ? (
          <>
            <Button type="button" variant="secondary" size="sm" onClick={share} disabled={disabled}>
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copied ? "Link copied" : "Share"}
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink hover:bg-surface-2"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Open map
            </a>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          </>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
