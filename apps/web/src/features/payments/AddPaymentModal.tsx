import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  PAY_ZONE_VALUES,
  PAY_ZONE_LABELS,
  type PayZoneValue,
} from "@/features/payments/types";
import { useCreatePayment } from "@/features/payments/queries";
import { useUsers, flattenUsers } from "@/features/users/queries";

export interface PaymentFkOption {
  id: string;
  name: string;
}

export function AddPaymentModal({
  open,
  onClose,
  salespeople,
  customers = [],
}: {
  open: boolean;
  onClose: () => void;
  salespeople?: PaymentFkOption[];
  customers?: PaymentFkOption[];
}) {
  const create = useCreatePayment();

  // Same "no options handed down" fallback as AddCustomerModal — the global
  // Topbar Quick-Create → Invoice entry in layout.tsx mounts this modal bare
  // (no salespeople prop), so fetch users directly instead of always showing
  // "no salespersons". PaymentsPage passes its own rows-derived list, which
  // takes priority and skips this fetch entirely.
  const needsOwnFetch = salespeople === undefined;
  const usersQuery = useUsers({}, { enabled: needsOwnFetch && open });
  const fetchedSalespeople = useMemo(
    () =>
      flattenUsers(usersQuery.data)
        .filter((u) => u.roleName === "sales")
        .map((u) => ({ id: u.id, name: u.name })),
    [usersQuery.data],
  );
  const salespersonOptions = salespeople ?? fetchedSalespeople;
  const salespeopleLoading = needsOwnFetch && usersQuery.isLoading;

  const [refNo, setRefNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [received, setReceived] = useState<string>("");
  const [salespersonId, setSalespersonId] = useState("");
  const [payZone, setPayZone] = useState<PayZoneValue>("GreenZone");
  const [delayReason, setDelayReason] = useState("");

  // A typed party name that exactly matches (case-insensitive) an existing
  // customer derived from already-loaded payment rows resolves to that
  // customer's id; anything else is sent as a bare `customerName` with no
  // `customerId` (there is no FK picker / customers fetch here — see the
  // brief's "derive FK options from rows" instruction).
  const matchedCustomer = useMemo(
    () => customers.find((c) => c.name.toLowerCase() === customerName.trim().toLowerCase()),
    [customers, customerName],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!amount.trim() || Number.isNaN(amountNum)) return;

    try {
      await create.mutateAsync({
        amount: amountNum,
        refNo: refNo.trim() || undefined,
        customerId: matchedCustomer?.id ?? null,
        customerName: customerName.trim() || undefined,
        salespersonId: salespersonId || undefined,
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || undefined,
        received: received.trim() ? Number(received) : undefined,
        payZone,
        delayReason: delayReason.trim() || undefined,
      });

      setRefNo("");
      setCustomerName("");
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setDueDate("");
      setAmount("");
      setReceived("");
      setSalespersonId("");
      setPayZone("GreenZone");
      setDelayReason("");
      onClose();
    } catch {
      // Surfaced inline below via create.error.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-brand" />
          <span>Add Invoice Manually</span>
        </div>
      }
      description="Add a single outstanding invoice to the payments tracker"
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!amount.trim() || create.isPending}>
            {create.isPending ? "Saving…" : "Save Invoice"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Invoice Date
            </label>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Ref No.
            </label>
            <Input
              placeholder="e.g. PMTPL/1842/24-25"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Party&apos;s Name
          </label>
          <Input
            placeholder="e.g. Anand Automotive Systems Pvt Ltd"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Invoice Amount ₹ *
            </label>
            <Input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Received ₹
            </label>
            <Input
              type="number"
              step="0.01"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Due Date
            </label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Risk Zone
            </label>
            <Select value={payZone} onChange={(e) => setPayZone(e.target.value as PayZoneValue)}>
              {PAY_ZONE_VALUES.map((z) => (
                <option key={z} value={z}>
                  {PAY_ZONE_LABELS[z]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Salesperson
          </label>
          {salespeopleLoading ? (
            <p className="text-[11px] text-muted">Loading salespersons…</p>
          ) : salespersonOptions.length === 0 ? (
            <p className="text-[11px] text-muted">No salespersons yet.</p>
          ) : (
            <Select value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
              <option value="">— Unassigned —</option>
              {salespersonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Reason
          </label>
          <Input
            placeholder="e.g. Bill under verification / MSME"
            value={delayReason}
            onChange={(e) => setDelayReason(e.target.value)}
          />
        </div>

        {create.isError && (
          <p className="text-[11.5px] font-medium text-red">
            {create.error instanceof ApiError ? create.error.message : "Failed to create invoice."}
          </p>
        )}
      </form>
    </Dialog>
  );
}
