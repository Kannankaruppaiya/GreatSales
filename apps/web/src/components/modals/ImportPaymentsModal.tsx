import { useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { useTrackerStore } from "@/store/trackerStore";
import { inr } from "@/lib/format";
import type { Payment } from "@/data/types";

// Flexible header normalizer
function normH(h: any): string {
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
  salesperson: "salesperson",
  sp: "salesperson",
  zone: "zone",
  riskzone: "zone",
  reason: "delayReason",
  delayreason: "delayReason",
};

export function ImportPaymentsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { customers, users, payments, importPayments } = useTrackerStore();

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalRows: number;
    validRows: number;
    newAdded: number;
    duplicatesSkipped: number;
    totalPending: number;
  } | null>(null);
  const [parsedRecords, setParsedRecords] = useState<Payment[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rawJson || rawJson.length < 2) {
          alert("Empty or invalid spreadsheet format.");
          setLoading(false);
          return;
        }

        // Detect header row
        const headerRow: string[] = rawJson[0];
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

        const newRecords: Payment[] = [];
        let dupCount = 0;
        let pendingSum = 0;

        const existingRefMap = new Set(payments.map((p) => p.refNo.toLowerCase().trim()));

        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          const refNo = String(row[refIdx] || "").trim();
          const party = String(row[partyIdx] || "").trim();
          if (!refNo && !party) continue;

          if (existingRefMap.has(refNo.toLowerCase())) {
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

          // Find customer and salesperson
          const matchedCust = customers.find(
            (c) =>
              c.name.toLowerCase().includes(party.toLowerCase()) ||
              party.toLowerCase().includes(c.name.toLowerCase())
          );
          const ownerId = matchedCust?.ownerId || users.find((u) => u.role === "sales")?.id || "u_sankar";

          newRecords.push({
            id: `pmt_imp_${Date.now()}_${i}`,
            refNo,
            customerId: matchedCust?.id || "c_unassigned",
            customerName: party || "Customer",
            ownerId,
            invoiceDate: dateStr,
            dueDate: dateStr,
            amount: openAmt,
            pending: pendAmt,
            received: recvAmt,
            zone: matchedCust?.payZone || "Green Zone",
            nextFollowUp: null,
            mail1: false,
            mail2: false,
            mail3: false,
            mail4: false,
          });

          pendingSum += pendAmt;
        }

        setParsedRecords(newRecords);
        setStats({
          totalRows: rawJson.length - 1,
          validRows: newRecords.length + dupCount,
          newAdded: newRecords.length,
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

  const handleApply = () => {
    if (parsedRecords.length > 0) {
      importPayments(parsedRecords);
    }
    onClose();
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
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!stats || stats.newAdded === 0}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Import {stats?.newAdded || 0} Invoices
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

              <div className="text-muted">Valid invoices:</div>
              <div className="font-bold text-ink text-right tabular-nums">{stats.validRows}</div>

              <div className="text-muted">New invoices to import:</div>
              <div className="font-bold text-brand text-right tabular-nums">{stats.newAdded}</div>

              <div className="text-muted">Duplicates skipped:</div>
              <div className="font-bold text-muted text-right tabular-nums">{stats.duplicatesSkipped}</div>

              <div className="text-muted">Total new pending value:</div>
              <div className="font-bold text-ink text-right tabular-nums">{inr(stats.totalPending)}</div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
