import { Printer } from "lucide-react";
import { Button, Dialog } from "./ui";
import { inr } from "../lib/format";
import type { SalesOrder } from "../data/types";

export function InvoicePrintModal({
  open,
  onClose,
  order,
}: {
  open: boolean;
  onClose: () => void;
  order: SalesOrder | null;
}) {
  if (!order) return null;

  const totalValue = order.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const gstValue = Math.round(totalValue * 0.18);
  const grandTotal = totalValue + gstValue;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between w-full">
          <span>Order Invoice Preview — {order.code}</span>
        </div>
      }
      description="Official commercial sales order and delivery challan"
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Close
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print / Save PDF
          </Button>
        </>
      }
    >
      <div className="bg-white text-slate-900 p-6 rounded-xl border border-slate-200 text-xs space-y-5 print:border-none print:p-0">
        {/* Company Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="text-lg font-black tracking-tight text-slate-900">GREATSALES ENTERPRISE</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Authorised Industrial Lubricants & Fluids Distributor</div>
            <div className="text-[11px] text-slate-500">GSTIN: 33AAACG1234F1Z5 · CIN: U51909TN2020PTC123456</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-extrabold text-emerald-800">SALES ORDER</div>
            <div className="font-mono font-bold text-xs text-slate-900 mt-0.5">{order.code}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Date: {order.createdAt ? order.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
            </div>
          </div>
        </div>

        {/* Bill To & Dispatch Details */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1">
            <div className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Customer / Buyer</div>
            <div className="font-bold text-slate-900">{order.customerName}</div>
            <div className="text-slate-600 text-[11px]">{order.deliveryAddress || "Standard Plant Delivery"}</div>
            <div className="text-slate-500 text-[11px]">Payment Terms: {order.paymentTerm || order.paymentTerms || "30 Days Credit"}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1">
            <div className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Logistics & Dispatch</div>
            <div className="text-slate-700">Mode: <b className="text-slate-900">{order.deliveryMode || "Standard Road Freight"}</b></div>
            <div className="text-slate-700">Transporter: <b className="text-slate-900">{order.transporterName || "Internal Fleet"}</b></div>
            <div className="text-slate-700">Priority: <b className="text-emerald-700">{order.isUrgent ? "Urgent / Express" : "Standard"}</b></div>
          </div>
        </div>

        {/* Itemized Table */}
        <table className="w-full text-left text-xs border-collapse border border-slate-200">
          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-2 px-3 w-8">#</th>
              <th className="py-2 px-3">Description of Goods</th>
              <th className="py-2 px-3 text-right">Qty</th>
              <th className="py-2 px-3 text-right">Unit Rate ₹</th>
              <th className="py-2 px-3 text-right">Amount ₹</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {order.lines.map((l, i) => (
              <tr key={i}>
                <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                <td className="py-2 px-3 font-semibold text-slate-900">
                  {l.productName}
                  {l.principalName && <span className="text-slate-400 text-[11px]"> · {l.principalName}</span>}
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">{l.qty} {l.unit || "Ltr"}</td>
                <td className="py-2 px-3 text-right tabular-nums">{l.price.toFixed(2)}</td>
                <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">
                  {(l.qty * l.price).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200 text-xs">
            <tr>
              <td colSpan={4} className="py-1.5 px-3 text-right font-semibold text-slate-600">Sub Total:</td>
              <td className="py-1.5 px-3 text-right tabular-nums font-bold">{inr(totalValue)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="py-1.5 px-3 text-right font-semibold text-slate-600">GST @ 18%:</td>
              <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-slate-700">{inr(gstValue)}</td>
            </tr>
            <tr className="border-t border-slate-300">
              <td colSpan={4} className="py-2 px-3 text-right font-extrabold text-slate-900">Grand Total:</td>
              <td className="py-2 px-3 text-right tabular-nums font-black text-emerald-800 text-sm">{inr(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures & Notes */}
        <div className="pt-8 grid grid-cols-2 gap-8 text-[11px] text-slate-500 border-t border-slate-200">
          <div>
            <div className="font-bold text-slate-800 mb-0.5">Terms & Conditions:</div>
            <div>1. Goods once sold will not be taken back or exchanged.</div>
            <div>2. Interest @ 18% p.a. will be charged for delayed payments beyond agreed credit days.</div>
          </div>
          <div className="text-right flex flex-col justify-between items-end h-20">
            <div>For <b className="text-slate-900">GREATSALES ENTERPRISE</b></div>
            <div className="border-t border-slate-300 pt-1 w-44 text-center text-[10px] font-semibold text-slate-600">
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
