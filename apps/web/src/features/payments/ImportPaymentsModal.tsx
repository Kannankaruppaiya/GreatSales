import { useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { useImportPayments } from "@/features/payments/queries";
import {
  PAY_ZONE_LABELS,
  PAYMENT_IMPORT_MAX_ROWS,
  type PayZoneValue,
  type PaymentImportRow,
  type PaymentImportResult,
} from "@/features/payments/types";

// Flexible header normalizer
function normH(h: unknown): string {
  return String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const PAY_HEADER_MAP: Record<string, string> = {
  date: "invoiceDate",
  invdate: "invoiceDate",
  invoicedate: "invoiceDate",
  refno: "refNo",
  ref: "refNo",
  particulars: "customerName",
  partyname: "customerName",
  party: "customerName",
  customer: "customerName",
  customername: "customerName",
  openingamount: "amount",
  opening: "amount",
  amount: "amount",
  pendingamount: "pending",
  pending: "pending",
  balance: "pending",
  received: "received",
  zone: "payZone",
  riskzone: "payZone",
  reason: "delayReason",
  delayreason: "delayReason",
};

/**
 * `payZone` is a free-text spreadsheet column — accepts either the raw DB
 * enum (`GreenZone`) or the friendly label ("Green Zone") and normalizes to
 * the raw value the API validates against (PayZoneSchema). Unrecognized/
 * blank values fall back to "GreenZone", the same default AddPaymentModal
 * uses for a brand-new invoice.
 */
function normalizeZone(raw: string): PayZoneValue {
  const norm = raw.trim().toLowerCase();
  for (const [value, label] of Object.entries(PAY_ZONE_LABELS)) {
    if (label.toLowerCase() === norm || value.toLowerCase() === norm) {
      return value as PayZoneValue;
    }
  }
  if (norm.includes("red")) return "RedZone";
  if (norm.includes("yellow") || norm.includes("amber")) return "YellowZone";
  if (norm.includes("black")) return "Blacklist";
  return "GreenZone";
}

/**
 * A parsed spreadsheet row, ready to POST. `rowNumber` is the 1-based line in
 * the source sheet (header is row 1), so the server's per-row report points
 * back at the exact line the user sees.
 */
interface ParsedRow extends PaymentImportRow {
  rowNumber: number;
}

export function ImportPaymentsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // The server is the sole integrity boundary: it re-validates every row,
  // de-dupes references against the WHOLE table (not a loaded page), and
  // commits the sheet in one transaction with a per-row report. The browser
  // parses only to PREVIEW — deliberately no client-side dedupe here, which is
  // what let a duplicate slip through while the payments list was paginated.
  const imp = useImportPayments();

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalRows: number;
    validRows: number;
    totalPending: number;
  } | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<PaymentImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const resetOutcome = () => {
    setResults(null);
    setImportError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    resetOutcome();
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rawJson || rawJson.length < 2) {
          alert("Empty or invalid spreadsheet format.");
          setLoading(false);
          return;
        }

        // Detect header row
        const headerRow = rawJson[0] as unknown[];
        const mappedIndices: Record<string, number> = {};

        headerRow.forEach((colName, colIdx) => {
          const norm = normH(colName);
          if (PAY_HEADER_MAP[norm]) {
            mappedIndices[PAY_HEADER_MAP[norm]] = colIdx;
          }
        });

        // Fallback standard positions if header names weren't recognized
        const dateIdx = mappedIndices["invoiceDate"] ?? 0;
        const refIdx = mappedIndices["refNo"] ?? 1;
        const partyIdx = mappedIndices["customerName"] ?? 2;
        const openIdx = mappedIndices["amount"] ?? 3;
        const pendIdx = mappedIndices["pending"] ?? 4;
        const recvIdx = mappedIndices["received"] ?? -1;
        const zoneIdx = mappedIndices["payZone"] ?? -1;
        const reasonIdx = mappedIndices["delayReason"] ?? -1;

        const newRecords: ParsedRow[] = [];
        let pendingSum = 0;

        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i] as unknown[];
          if (!row || row.length === 0) continue;

          const refNo = String(row[refIdx] || "").trim();
          const party = String(row[partyIdx] || "").trim();
          if (!refNo && !party) continue;

          let dateStr = String(row[dateIdx] || "").trim();
          if (/^\d{5}$/.test(dateStr)) {
            // Excel serial date format
            const d = new Date((Number(dateStr) - (25567 + 2)) * 86400 * 1000);
            dateStr = d.toISOString().slice(0, 10);
          } else if (dateStr.includes("/")) {
            const parts = dateStr.split("/");
            if (parts.length === 3) {
              dateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }
          } else if (!dateStr) {
            dateStr = new Date().toISOString().slice(0, 10);
          }

          const openAmt = Number(String(row[openIdx] || "0").replace(/[^0-9.-]/g, "")) || 0;
          const pendAmt = Number(String(row[pendIdx] || "0").replace(/[^0-9.-]/g, "")) || openAmt;
          const recvAmt =
            recvIdx >= 0
              ? Number(String(row[recvIdx] || "0").replace(/[^0-9.-]/g, "")) || 0
              : openAmt > pendAmt
                ? openAmt - pendAmt
                : 0;

          newRecords.push({
            // Header is sheet row 1, so data row i maps to sheet line i + 1.
            rowNumber: i + 1,
            refNo: refNo || null,
            customerName: party || "Customer",
            invoiceDate: dateStr,
            amount: Math.max(0, openAmt || pendAmt),
            received: Math.max(0, recvAmt),
            payZone: normalizeZone(zoneIdx >= 0 ? String(row[zoneIdx] || "") : ""),
            delayReason: reasonIdx >= 0 ? String(row[reasonIdx] || "").trim() : "",
          });

          pendingSum += pendAmt;
        }

        if (newRecords.length > PAYMENT_IMPORT_MAX_ROWS) {
          alert(
            `This sheet has ${newRecords.length} rows — more than the ${PAYMENT_IMPORT_MAX_ROWS}` +
              ` allowed in one import. Split it into smaller files.`,
          );
          setLoading(false);
          return;
        }

        setParsedRecords(newRecords);
        setStats({
          totalRows: rawJson.length - 1,
          validRows: newRecords.length,
          totalPending: pendingSum,
        });
      } catch (err) {
        alert("Failed to parse excel file: " + String(err));
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleApply = async () => {
    if (parsedRecords.length === 0) return;
    resetOutcome();

    const rows: PaymentImportRow[] = parsedRecords.map((r) => ({
      rowNumber: r.rowNumber,
      amount: r.amount,
      refNo: r.refNo ?? null,
      customerName: r.customerName ?? null,
      invoiceDate: r.invoiceDate ?? null,
      received: r.received || undefined,
      payZone: r.payZone ?? null,
      delayReason: r.delayReason || undefined,
    }));

    try {
      const res = await imp.mutateAsync({ rows });
      setResults(res);
    } catch (err) {
      // A hard failure means the whole import rolled back — nothing was saved.
      setImportError(
        err instanceof ApiError
          ? err.message
          : "The import failed and was rolled back. No payments were saved.",
      );
    }
  };

  // Rows the server did not create, worth surfacing line-by-line.
  const flaggedRows =
    results?.results.filter((r) => r.status !== "created") ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-brand" />
          <span>Import Weekly Outstanding Invoices</span>
        </div>
      }
      description="Upload an .xlsx or .xls file from Tally/ERP to synchronize pending balances"
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Close
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={
              !stats || parsedRecords.length === 0 || imp.isPending || results !== null
            }
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {imp.isPending ? "Importing…" : `Import ${parsedRecords.length} Invoices`}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Upload Box */}
        <div className="rounded-xl border-2 border-dashed border-line bg-surface-2 p-6 text-center hover:border-brand transition-colors">
          <input
            type="file"
            id="excel-file-input"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label
            htmlFor="excel-file-input"
            className="cursor-pointer flex flex-col items-center justify-center space-y-2"
          >
            <Upload className="h-8 w-8 text-brand animate-bounce" />
            <div className="font-bold text-ink">Choose Tally / ERP Excel File</div>
            <div className="text-xs text-muted">Supports .xlsx, .xls, .csv with standard columns</div>
          </label>
        </div>

        {loading && <div className="text-center text-xs text-brand font-medium">Parsing spreadsheet data…</div>}

        {/* Stats Preview */}
        {stats && (
          <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
            <div className="font-bold text-ink text-xs uppercase tracking-wider">Spreadsheet Summary</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-muted">Total rows scanned:</div>
              <div className="font-bold text-ink text-right tabular-nums">{stats.totalRows}</div>

              <div className="text-muted">Ready to import:</div>
              <div className="font-bold text-brand text-right tabular-nums">{parsedRecords.length}</div>

              <div className="text-muted">Total pending value:</div>
              <div className="font-bold text-ink text-right tabular-nums">{inr(stats.totalPending)}</div>
            </div>
            <div className="text-[11px] text-muted">
              Duplicate references are detected and skipped on the server, checked against every
              invoice — not just the ones on screen.
            </div>
          </div>
        )}

        {/* Hard failure — the whole import rolled back */}
        {importError && (
          <div className="rounded-xl border border-red/40 bg-red-soft p-3.5 text-[11px] font-medium text-red">
            {importError}
          </div>
        )}

        {/* Import results */}
        {results && (
          <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
            <div className="font-bold text-ink text-xs uppercase tracking-wider">Import Result</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-muted">Created:</div>
              <div className="font-bold text-brand text-right tabular-nums">{results.created}</div>
              <div className="text-muted">Duplicates skipped:</div>
              <div className="font-bold text-muted text-right tabular-nums">{results.skippedDuplicates}</div>
              <div className="text-muted">Failed:</div>
              <div className={`font-bold text-right tabular-nums ${results.failed > 0 ? "text-red" : "text-ink"}`}>
                {results.failed}
              </div>
            </div>
            {flaggedRows.length > 0 && (
              <ul className="space-y-1 max-h-28 overflow-y-auto text-[11px]">
                {flaggedRows.map((r) => (
                  <li
                    key={r.rowNumber}
                    className={r.status === "error" ? "text-red" : "text-muted"}
                  >
                    Row {r.rowNumber}
                    {r.refNo ? ` (${r.refNo})` : ""}: {r.message ?? r.status}
                  </li>
                ))}
              </ul>
            )}
            <div className="text-[11px] text-muted">Re-upload a file to import again.</div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
