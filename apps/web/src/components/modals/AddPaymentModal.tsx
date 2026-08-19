import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button, Dialog, Input, Select } from "../ui";
import { PAY_ZONES, type PayZone } from "../../data/constants";
import { useTrackerStore } from "../../store/trackerStore";
import { useUi } from "../../store/ui";

export function AddPaymentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { customers, users, addPayment } = useTrackerStore();
  const { ownerId } = useUi();
  const salespeople = users.filter((u) => u.role === "sales");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [refNo, setRefNo] = useState("");
  const [partyName, setPartyName] = useState("");
  const [opening, setOpening] = useState<number>(0);
  const [pending, setPending] = useState<number>(0);
  const [assignedOwnerId, setAssignedOwnerId] = useState(salespeople[0]?.id || ownerId);
  const [zone, setZone] = useState<PayZone>("Green Zone");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refNo.trim() || !partyName.trim()) return;

    const matchedCust = customers.find(
      (c) => c.name.toLowerCase().includes(partyName.toLowerCase()) || partyName.toLowerCase().includes(c.name.toLowerCase())
    );

    addPayment({
      refNo: refNo.trim(),
      customerId: matchedCust?.id || "c_manual",
      customerName: partyName.trim(),
      ownerId: assignedOwnerId,
      invoiceDate: date,
      dueDate: date,
      amount: opening || pending,
      pending: pending || opening,
      received: opening > pending ? opening - pending : 0,
      zone,
      delayReason: reason.trim() || undefined,
      nextFollowUp: null,
      mail1: false,
      mail2: false,
      mail3: false,
      mail4: false,
    });

    onClose();
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
          <Button size="sm" onClick={handleSubmit} disabled={!refNo.trim() || !partyName.trim()}>
            Save Invoice
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Date *
            </label>
            <Input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Ref No. *
            </label>
            <Input
              required
              placeholder="e.g. PMTPL/1842/24-25"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Party&apos;s Name *
          </label>
          <Input
            required
            placeholder="e.g. Anand Automotive Systems Pvt Ltd"
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Opening Amount ₹
            </label>
            <Input
              type="number"
              value={opening || ""}
              onChange={(e) => {
                const v = Number(e.target.value);
                setOpening(v);
                if (!pending) setPending(v);
              }}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Pending Amount ₹ *
            </label>
            <Input
              type="number"
              required
              value={pending || ""}
              onChange={(e) => setPending(Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Salesperson
            </label>
            <Select value={assignedOwnerId} onChange={(e) => setAssignedOwnerId(e.target.value)}>
              {salespeople.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Zone
            </label>
            <Select value={zone} onChange={(e) => setZone(e.target.value as PayZone)}>
              {PAY_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Reason
          </label>
          <Input
            placeholder="e.g. Bill under verification / MSME"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </form>
    </Dialog>
  );
}
