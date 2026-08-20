import { useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { useCreatePayment } from "@/features/payments/queries";
import { PAY_ZONE_LABELS, type PayZoneValue, type PaymentCreate } from "@/features/payments/types";

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

interface ParsedRow {
  refNo: string;
  customerName: string;
  invoiceDate: string;
  amount: number;
  received: number;
  payZone: PayZoneValue;
  delayReason: string;
}

export function ImportPaymentsModal({
  open,
  onClose,
  existingRefNos = [],
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Ref numbers already visible in the currently-loaded (paginated) payments
   * list, used only to skip obvious duplicates during parsing. There is no
   * server-side "check all invoices" endpoint, so this can miss a duplicate
   * that exists beyond the currently loaded page(s) — the API itself is the
   * real source of truth and may still reject/accept as it sees fit.
   */
  existingRefNos?: string[];
}) {
  const create = useCreatePayment();

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalRows: number;
    validRows: number;
    duplicatesSkipped: number;
    totalPending: number;
  } | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(
    null,
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResults(null);
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
        let dupCount = 0;
        let pendingSum = 0;

        const existingRefSet = new Set(existingRefNos.map((r) => r.toLowerCase().trim()));

        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i] as unknown[];
          if (!row || row.length === 0) continue;

          const refNo = String(row[refIdx] || "").trim();
          const party = String(row[partyIdx] || "").trim();
          if (!refNo && !party) continue;

          if (refNo && existingRefSet.has(refNo.toLowerCase())) {
            dupCount++;
            continue;
          }

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
            refNo,
            customerName: party || "Customer",
            invoiceDate: dateStr,
            amount: openAmt || pendAmt,
            received: recvAmt,
            payZone: normalizeZone(zoneIdx >= 0 ? String(row[zoneIdx] || "") : ""),
            delayReason: reasonIdx >= 0 ? String(row[reasonIdx] || "").trim() : "",
          });

          pendingSum += pendAmt;
        }

        setParsedRecords(newRecords);
        setStats({
          totalRows: rawJson.length - 1,
          validRows: newRecords.length + dupCount,
          duplicatesSkipped: dupCount,
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
    setImporting(true);

    let success = 0;
    const errors: string[] = [];

    // Sequential, not Promise.all: keeps errors attributable to a specific
    // row and avoids hammering the API with 100+ concurrent POSTs on a large
    // spreadsheet.
    for (const rec of parsedRecords) {
      const body: PaymentCreate = {
        amount: rec.amount,
        refNo: rec.refNo || undefined,
        customerName: rec.customerName,
        invoiceDate: rec.invoiceDate,
        received: rec.received || undefined,
        payZone: rec.payZone,
        delayReason: rec.delayReason || undefined,
      };
      try {
        await create.mutateAsync(body);
        success++;
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Failed to create invoice.";
        errors.push(`${rec.refNo || rec.customerName}: ${msg}`);
      }
    }

    setImporting(false);
    setResults({ success, failed: parsedRecords.length - success, errors });
    if (errors.length === 0) onClose();
  };

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
            disabled={!stats || parsedRecords.length === 0 || importing}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {importing ? "Importing…" : `Import ${parsedRecords.length} Invoices`}
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

              <div className="text-muted">Duplicates skipped:</div>
              <div className="font-bold text-muted text-right tabular-nums">{stats.duplicatesSkipped}</div>

              <div className="text-muted">Total pending value:</div>
              <div className="font-bold text-ink text-right tabular-nums">{inr(stats.totalPending)}</div>
            </div>
          </div>
        )}

        {/* Import results */}
        {results && (
          <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
            <div className="font-bold text-ink text-xs uppercase tracking-wider">Import Result</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-muted">Created:</div>
              <div className="font-bold text-brand text-right tabular-nums">{results.success}</div>
              <div className="text-muted">Failed:</div>
              <div className={`font-bold text-right tabular-nums ${results.failed > 0 ? "text-red" : "text-ink"}`}>
                {results.failed}
              </div>
            </div>
            {results.errors.length > 0 && (
              <ul className="space-y-1 max-h-28 overflow-y-auto text-[11px] text-red">
                {results.errors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
