import { useMemo, useState } from "react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const matchedCustomer = useMemo(
    () => customers.find((c) => c.name.toLowerCase() === customerName.trim().toLowerCase()),
    [customers, customerName],
  );

  const isDirty =
    refNo.trim() !== "" ||
    customerName.trim() !== "" ||
    dueDate !== "" ||
    amount.trim() !== "" ||
    received.trim() !== "" ||
    salespersonId !== "" ||
    delayReason.trim() !== "";

  const handleAttemptClose = () => {
    if (isDirty && !create.isPending) {
      setShowDiscardConfirm(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setShowDiscardConfirm(false);
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
  };

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

      handleForceClose();
    } catch {
      // Surfaced inline below via create.error.
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleAttemptClose}
        title="Add Invoice Manually"
        description="Add a single outstanding invoice to the payments tracker."
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAttemptClose}
              type="button"
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!amount.trim() || create.isPending}
            >
              {create.isPending ? "Saving…" : "Save Invoice"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="payment-invoice-date"
                className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
              >
                Invoice Date
              </label>
              <Input
                id="payment-invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="payment-ref-no"
                className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
              >
                Ref No.
              </label>
              <Input
                id="payment-ref-no"
                placeholder="e.g. PMTPL/1842/24-25"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="payment-customer-name"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Party&apos;s Name
            </label>
            <Input
              id="payment-customer-name"
              placeholder="e.g. Anand Automotive Systems Pvt Ltd"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="payment-amount"
                className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
              >
                Invoice Amount <span className="text-red">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                  ₹
                </span>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="payment-received"
                className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
              >
                Received Amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                  ₹
                </span>
                <Input
                  id="payment-received"
                  type="number"
                  step="0.01"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="payment-due-date"
                className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
              >
                Due Date
              </label>
              <Input
                id="payment-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="payment-risk-zone"
                className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
              >
                Risk Zone
              </label>
              <Select
                id="payment-risk-zone"
                value={payZone}
                onChange={(e) => setPayZone(e.target.value as PayZoneValue)}
              >
                {PAY_ZONE_VALUES.map((z) => (
                  <option key={z} value={z}>
                    {PAY_ZONE_LABELS[z]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label
              htmlFor="payment-salesperson"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Salesperson
            </label>
            <Select
              id="payment-salesperson"
              value={salespersonId}
              onChange={(e) => setSalespersonId(e.target.value)}
              disabled={salespeopleLoading || salespersonOptions.length === 0}
            >
              <option value="">
                {salespeopleLoading
                  ? "Loading salespersons…"
                  : salespersonOptions.length === 0
                    ? "— No salespersons available —"
                    : "— Unassigned —"}
              </option>
              {salespersonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label
              htmlFor="payment-delay-reason"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5"
            >
              Reason
            </label>
            <Input
              id="payment-delay-reason"
              placeholder="e.g. Bill under verification / MSME"
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
            />
          </div>

          {create.isError && (
            <p role="alert" className="text-[11.5px] font-medium text-red">
              {create.error instanceof ApiError ? create.error.message : "Failed to create invoice."}
            </p>
          )}
        </form>
      </Dialog>

      <ConfirmActionModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Invoice Changes?"
        body="You have unsaved invoice information entered. Are you sure you want to discard your changes?"
        confirmLabel="Discard Changes"
        destructive
        onConfirm={handleForceClose}
      />
    </>
  );
}
