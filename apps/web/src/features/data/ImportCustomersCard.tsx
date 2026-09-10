import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Button, Card, CardHeader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useFeature } from "@/lib/featureFlags";

/** Mirrors `IMPORT_MAX_ROWS` in packages/shared/src/import.ts. */
const MAX_ROWS = 500;

interface ImportRowError {
  line: number;
  name: string;
  reason: string;
}
interface ImportJobRow {
  id: string;
  status: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
  createdAt: string;
}

/**
 * The column headings this reads, and the field each becomes.
 *
 * Matched case- and space-insensitively, and with more than one accepted
 * spelling, because the file comes from whatever the workspace already keeps
 * its customers in. A strict header row would mean every import began by
 * editing the spreadsheet, which is the work this is meant to remove.
 */
const COLUMNS: Record<string, string> = {
  name: "name",
  customer: "name",
  customername: "name",
  company: "name",
  area: "area",
  location: "area",
  category: "category",
  tier: "category",
  paymentterms: "paymentTerms",
  terms: "paymentTerms",
  contact: "contactName",
  contactname: "contactName",
  phone: "phone",
  mobile: "phone",
  email: "email",
  salesperson: "salespersonName",
  owner: "salespersonName",
  salespersonname: "salespersonName",
};

const normalise = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Load customers from a spreadsheet.
 *
 * The FILE is read here rather than posted. The formats a workspace will
 * actually hand over are .xlsx as often as .csv, this app already carries a
 * reader for both, and sending the binary to the API would put a second parser
 * on the server that has to agree with this one about what a merged cell or a
 * date column means. Rows cross the wire; rows are what the API validates.
 */
export function ImportCustomersCard() {
  const enabled = useFeature("bulk-import");
  const fileInput = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportJobRow | null>(null);
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "update">("skip");

  /**
   * What the last few imports did.
   *
   * The server keeps every run precisely so the answer survives the tab being
   * closed — a person who imported four hundred rows yesterday and wants to
   * know which ones failed should not have to import them again to find out.
   * Keeping that only in React state would have made the stored row pointless.
   */
  const history = useQuery({
    queryKey: ["imports"],
    enabled,
    queryFn: () => apiFetch<ImportJobRow[]>("/imports?limit=5"),
  });

  if (!enabled) return null;

  const handleFile = async (file: File) => {
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      if (!sheet) throw new Error("That file has no sheets in it.");

      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
      });
      if (!raw.length) throw new Error("That sheet has no rows under its header.");

      const rows = raw.map((r, i) => {
        // +2, not +1: row 1 is the header, so the first data row is line 2 in
        // the file the person is looking at.
        const out: Record<string, unknown> = { line: i + 2 };
        for (const [heading, value] of Object.entries(r)) {
          const field = COLUMNS[normalise(heading)];
          if (!field) continue;
          const text = value == null ? null : String(value).trim();
          out[field] = text === "" ? null : text;
        }
        return out;
      });

      const named = rows.filter((r) => r.name);
      if (!named.length) {
        throw new Error(
          "No column in that sheet looks like a customer name. Name one of them Name, Customer or Company.",
        );
      }
      if (named.length > MAX_ROWS) {
        throw new Error(
          `That file has ${named.length} rows. Import up to ${MAX_ROWS} at a time.`,
        );
      }

      setResult(
        await apiFetch<ImportJobRow>("/imports/customers", {
          method: "POST",
          body: JSON.stringify({ rows: named, onDuplicate }),
        }),
      );
      // The customers page is now wrong by however many rows just landed, and
      // the history below is one run short.
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["imports"] });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "That file could not be read.",
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader
        title="Import customers"
        hint="A .xlsx or .csv with a header row: Name, Area, Category, Payment terms, Contact, Phone, Email, Salesperson."
      />
      <div className="space-y-3 p-3.5 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            size="sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {busy ? "Importing…" : "Choose a file"}
          </Button>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              className="accent-brand"
              checked={onDuplicate === "update"}
              onChange={(e) =>
                setOnDuplicate(e.target.checked ? "update" : "skip")
              }
            />
            Update accounts that already exist
          </label>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-xs font-semibold text-red"
          >
            {error}
          </div>
        )}

        {/* Earlier runs. Shown only when there is no fresh result above, so the
            thing the user just did is not competing with a list of what they
            did last week. */}
        {!result && !error && (history.data?.length ?? 0) > 0 && (
          <ul className="space-y-1">
            {history.data!.map((job) => (
              <li
                key={job.id}
                className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5 text-2xs text-muted"
              >
                <span>
                  {new Date(job.createdAt).toLocaleDateString()} ·{" "}
                  {job.total} row{job.total === 1 ? "" : "s"}
                </span>
                <span>
                  <span className="font-semibold text-ink">{job.created} created</span>
                  {job.updated > 0 && <> · {job.updated} updated</>}
                  {job.skipped > 0 && <> · {job.skipped} skipped</>}
                  {job.errors.length > 0 && (
                    <> · <span className="font-semibold text-red">{job.errors.length} failed</span></>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {result && (
          <div className="space-y-2">
            <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink">
              <span className="font-bold">{result.created} created</span>
              {result.updated > 0 && <> · {result.updated} updated</>}
              {result.skipped > 0 && <> · {result.skipped} already there</>}
              {result.errors.length > 0 && (
                <> · <span className="font-bold text-red">{result.errors.length} not imported</span></>
              )}
            </div>

            {/* The rows that failed, with the line number they came from — the
                point of not rejecting the whole file is that the person can
                fix these few and import again. */}
            {result.errors.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {result.errors.map((e) => (
                  <li
                    key={`${e.line}-${e.name}`}
                    className="rounded-lg border border-amber/20 bg-amber-soft px-2.5 py-1.5 text-2xs text-amber"
                  >
                    <span className="font-bold">Row {e.line}</span>
                    {e.name ? ` — ${e.name}` : ""}: {e.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
