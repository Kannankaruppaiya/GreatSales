import { useMemo, useState, Fragment, memo, useCallback } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  Plus,
  Repeat,
  X,
} from "lucide-react";
import { MONTHS, PROJ_STATUSES, projTone } from "@/data/constants";
import { useTrackerStore } from "@/store/trackerStore";
import { useUi } from "@/store/ui";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { AddCustomerModal } from "@/components/modals/AddCustomerModal";
import { AddMappingModal } from "@/components/modals/AddMappingModal";
import { RemarksModal } from "@/components/modals/RemarksModal";
import { FollowUpModal } from "@/components/modals/FollowUpModal";
import { CreateSalesOrderModal } from "@/components/modals/CreateSalesOrderModal";
import { SalesOrderDetailModal } from "@/components/modals/SalesOrderDetailModal";
import { CustomerDrawer } from "@/components/CustomerDrawer";
import { toast } from "@/store/toastStore";
import type { Customer, Principal, Product, Projection, SalesOrder, User } from "@/data/types";

type LineFilter = "all" | "projected" | "blank" | "due";

const CAT_RANK: Record<string, number> = { Platinum: 0, Gold: 1, Silver: 2, Brass: 3, "": 4 };

// Memoized Single Projection Row for ultra-fast rendering & cell updates
interface RowProps {
  projection: Projection;
  idx: number;
  customer?: Customer;
  product?: Product;
  user?: User;
  salesOrder?: SalesOrder;
  principals: Principal[];
  principalProds: Product[];
  canEdit: boolean;
  showSp: boolean;
  isAdmin: boolean;
  isNewCust: boolean;
  showTierBreak: boolean;
  tierName: string;
  totalCols: number;
  todayStr: string;
  onOpenCustomer: (id: string) => void;
  onOpenRemarks: (p: Projection) => void;
  onOpenFollowUp: (p: Projection) => void;
  onCreateSo: (p: Projection) => void;
  onViewSo: (so: SalesOrder) => void;
  onUpdateCell: (id: string, field: "price" | "projectedQty" | "achievedQty" | "status" | "nextFollowUp" | "targetDate", value: any) => void;
  onChangePrincipal: (id: string, principalId: string) => void;
  onChangeProduct: (id: string, productId: string) => void;
  onDelete: (id: string, name?: string) => void;
}

const ProjectionRow = memo(function ProjectionRow({
  projection: p,
  idx,
  customer: cust,
  product: prod,
  user,
  salesOrder: so,
  principals,
  principalProds,
  canEdit,
  showSp,
  isAdmin,
  isNewCust,
  showTierBreak,
  tierName,
  totalCols,
  todayStr,
  onOpenCustomer,
  onOpenRemarks,
  onOpenFollowUp,
  onCreateSo,
  onViewSo,
  onUpdateCell,
  onChangePrincipal,
  onChangeProduct,
  onDelete,
}: RowProps) {
  const price = p.price != null ? p.price : (prod?.listPrice || 0);
  const pv = p.projectedQty && price ? p.projectedQty * price : 0;
  const av = p.achievedQty && price ? p.achievedQty * price : 0;
  const pctVal = pv > 0 ? (av / pv) * 100 : null;

  const nx = p.nextFollowUp;
  const isOverdue = nx && nx < todayStr;
  const isDueToday = nx && nx === todayStr;

  return (
    <Fragment>
      {/* Tier Category Break Header */}
      {showTierBreak && (
        <tr className="bg-surface-2/90 border-t border-b border-line shadow-2xs">
          <td
            colSpan={totalCols}
            className="py-2 px-3 text-[10.5px] font-black uppercase tracking-wider text-muted bg-surface-2/80"
          >
            {tierName} Category Accounts
          </td>
        </tr>
      )}

      <tr
        className={cn(
          "hover:bg-surface-2/70 transition-colors group",
          isNewCust && !showTierBreak && "border-t-2 border-line"
        )}
      >
        <td className="py-2 px-3 text-muted text-[11px] font-medium">{idx + 1}</td>
        <td className="py-2 px-3">
          <button
            type="button"
            onClick={() => onOpenCustomer(p.customerId)}
            className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left block leading-snug"
          >
            {cust?.name}
          </button>
          {cust?.contactName && (
            <span className="text-[11px] text-muted block">({cust.contactName})</span>
          )}
        </td>

        {showSp && (
          <td className="py-2 px-3 text-muted text-xs whitespace-nowrap">{user?.name || "—"}</td>
        )}

        {/* Principal Dropdown */}
        <td className="py-2 px-3">
          {canEdit ? (
            <select
              value={prod?.principalId || ""}
              onChange={(e) => onChangePrincipal(p.id, e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink max-w-[130px]"
            >
              {principals.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-ink font-semibold">{prod?.principalName}</span>
          )}
        </td>

        {/* Sub product Dropdown */}
        <td className="py-2 px-3">
          {canEdit ? (
            <select
              value={p.productId}
              onChange={(e) => onChangeProduct(p.id, e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink max-w-[210px] w-full font-medium"
            >
              {principalProds.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-ink font-medium">{prod?.name}</span>
          )}
        </td>

        {/* Price ₹ */}
        <td className="py-2 px-3 text-right">
          {canEdit ? (
            <input
              type="number"
              step="0.01"
              defaultValue={p.price != null ? p.price : ""}
              placeholder={prod?.listPrice != null ? String(prod.listPrice) : "—"}
              onBlur={(e) => {
                const val = e.target.value === "" ? null : Number(e.target.value);
                if (val !== p.price) onUpdateCell(p.id, "price", val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-18 rounded-md border border-line bg-surface px-1.5 py-1 text-right text-xs font-semibold tabular-nums focus:outline-brand focus:border-brand"
            />
          ) : (
            <span className="tabular-nums font-semibold">{p.price != null ? p.price : "—"}</span>
          )}
        </td>

        {/* Proj qty */}
        <td className="py-2 px-3 text-right">
          {canEdit ? (
            <input
              type="number"
              defaultValue={p.projectedQty || ""}
              placeholder="0"
              onBlur={(e) => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                if (val !== p.projectedQty) onUpdateCell(p.id, "projectedQty", val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-16 rounded-md border border-line bg-surface px-1.5 py-1 text-right text-xs font-bold tabular-nums focus:outline-brand focus:border-brand"
            />
          ) : (
            <span className="tabular-nums font-bold">{p.projectedQty || "—"}</span>
          )}
        </td>

        {/* Proj value */}
        <td className="py-2 px-3 text-right tabular-nums font-bold text-ink">
          {pv > 0 ? inr(pv) : "—"}
        </td>

        {/* Ach qty */}
        <td className="py-2 px-3 text-right">
          {canEdit ? (
            <input
              type="number"
              defaultValue={p.achievedQty || ""}
              placeholder="0"
              onBlur={(e) => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                if (val !== p.achievedQty) onUpdateCell(p.id, "achievedQty", val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-16 rounded-md border border-line bg-surface px-1.5 py-1 text-right text-xs font-bold tabular-nums text-brand focus:outline-brand focus:border-brand"
            />
          ) : (
            <span className="tabular-nums font-bold text-brand">{p.achievedQty || "—"}</span>
          )}
        </td>

        {/* Ach value */}
        <td className="py-2 px-3 text-right tabular-nums font-bold text-brand">
          {av > 0 ? inr(av) : "—"}
        </td>

        {/* Ach % */}
        <td className="py-2 px-3 text-right tabular-nums font-bold">
          {pctVal != null ? (
            <span
              className={cn(
                pctVal >= 100 ? "text-brand" : pctVal >= 50 ? "text-amber" : "text-red"
              )}
            >
              {pctVal.toFixed(0)}%
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>

        {/* Status */}
        <td className="py-2 px-3">
          {canEdit ? (
            <select
              value={p.status || ""}
              onChange={(e) => onUpdateCell(p.id, "status", e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink font-semibold max-w-[150px]"
            >
              <option value="">—</option>
              {PROJ_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          ) : (
            <StatusBadge label={p.status || "—"} tone={projTone(p.status)} />
          )}
        </td>

        {/* Next follow-up */}
        <td className="py-2 px-3">
          {canEdit ? (
            <input
              type="date"
              value={p.nextFollowUp || ""}
              onChange={(e) => onUpdateCell(p.id, "nextFollowUp", e.target.value || null)}
              className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs text-ink w-32 tabular-nums"
            />
          ) : (
            <span className="tabular-nums text-muted">{p.nextFollowUp || "—"}</span>
          )}
        </td>

        {/* Expected closure */}
        <td className="py-2 px-3">
          {canEdit ? (
            <input
              type="date"
              value={p.targetDate || ""}
              onChange={(e) => onUpdateCell(p.id, "targetDate", e.target.value || null)}
              className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs text-ink w-32 tabular-nums"
            />
          ) : (
            <span className="tabular-nums text-muted">{p.targetDate || "—"}</span>
          )}
        </td>

        {/* Remarks button */}
        <td className="py-2 px-3 text-center">
          <button
            type="button"
            onClick={() => onOpenRemarks(p)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted hover:border-brand hover:text-brand transition-all cursor-pointer inline-flex items-center gap-1 font-medium shadow-2xs"
          >
            <MessageSquare className="h-3 w-3" />
            <span>Remarks</span>
            {p.remarks && p.remarks.length > 0 && (
              <span className="rounded-full bg-brand text-white px-1.5 py-0.2 text-[10px] font-bold">
                {p.remarks.length}
              </span>
            )}
          </button>
        </td>

        {/* Follow-up log button */}
        <td className="py-2 px-3 text-center">
          <button
            type="button"
            onClick={() => onOpenFollowUp(p)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs transition-all cursor-pointer inline-flex items-center gap-1 font-medium whitespace-nowrap shadow-2xs",
              isOverdue
                ? "border-red text-red bg-red-soft"
                : isDueToday
                ? "border-amber text-amber bg-amber-soft"
                : "border-line bg-surface text-muted hover:border-brand hover:text-brand"
            )}
          >
            <CalendarClock className="h-3 w-3" />
            <span>{nx ? `Next ${nx.slice(5)}` : "Log follow-up"}</span>
          </button>
        </td>

        {/* Sales order cell */}
        <td className="py-2 px-3 text-center">
          {so ? (
            <button
              type="button"
              onClick={() => onViewSo(so)}
              className="rounded-lg border border-brand bg-brand-soft text-brand-ink px-2.5 py-1 text-xs font-bold hover:bg-brand hover:text-white transition-all cursor-pointer shadow-2xs"
            >
              {so.status}
            </button>
          ) : p.status === "Confirmed" || p.status === "Partially Confirmed" ? (
            canEdit ? (
              <button
                type="button"
                onClick={() => onCreateSo(p)}
                className="rounded-lg border border-line bg-surface text-ink px-2.5 py-1 text-xs font-bold hover:border-brand hover:text-brand transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
              >
                <Plus className="h-3 w-3" /> Create SO
              </button>
            ) : (
              <span className="text-muted text-[11px]">Confirmed</span>
            )
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>

        {/* Delete mapping action */}
        {isAdmin && (
          <td className="py-2 px-2 text-center">
            <button
              type="button"
              onClick={() => onDelete(p.id, `${cust?.name} × ${prod?.name}`)}
              className="text-red/60 hover:text-red p-1 cursor-pointer"
              title="Remove mapping"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </td>
        )}
      </tr>
    </Fragment>
  );
});

export default function ProjectionsPage() {
  const { month, principalId, ownerFilter } = useUi();
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const {
    customers,
    products,
    principals,
    projections,
    orders,
    users,
    updateProjectionCell,
    changeProjectionPrincipal,
    changeProjectionProduct,
    addProjectionRemark,
    setProjectionFollowUp,
    deleteProjection,
  } = useTrackerStore();

  const [search, setSearch] = useState("");
  const [lineChip, setLineChip] = useState<LineFilter>("all");
  const [pageSize, setPageSize] = useState<number>(50); // 50 items per page default for instant loading
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [selectedRemarksProj, setSelectedRemarksProj] = useState<Projection | null>(null);
  const [selectedFuProj, setSelectedFuProj] = useState<Projection | null>(null);
  const [createSoProj, setCreateSoProj] = useState<Projection | null>(null);
  const [viewSo, setViewSo] = useState<SalesOrder | null>(null);
  const [selectedDrawerCustId, setSelectedDrawerCustId] = useState<string | null>(null);

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? month;
  const canEdit = role !== "mgmt";
  const showSp = true; // always show salesperson column — no sales role on web
  const isAdmin = role === "admin" || role === "super_admin";
  const todayStr = new Date().toISOString().slice(0, 10);
  const totalCols = 16 + (showSp ? 1 : 0) + (isAdmin ? 1 : 0);

  // Fast pre-indexed lookups
  const custLookup = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const prodLookup = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const userLookup = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const orderLookup = useMemo(() => new Map(orders.filter((o) => o.status !== "Cancelled").map((o) => [o.id, o])), [orders]);

  // Pre-index products by principal ID to eliminate O(N^2) inner array filtering
  const prodsByPrincipal = useMemo(() => {
    const map = new Map<string, Product[]>();
    products.forEach((p) => {
      const list = map.get(p.principalId) || [];
      list.push(p);
      map.set(p.principalId, list);
    });
    return map;
  }, [products]);

  // Scoped projections
  const visibleProjections = useMemo(() => {
    const q = search.trim().toLowerCase();

    return projections
      .filter((p) => {
        if (p.month !== month) return false;
        if (ownerFilter !== "ALL" && p.ownerId !== ownerFilter) return false;

        const prod = prodLookup.get(p.productId);
        if (principalId !== "ALL" && prod?.principalId !== principalId) return false;

        const cust = custLookup.get(p.customerId);
        if (!cust || !prod) return false;

        if (q) {
          const matchCust = cust.name.toLowerCase().includes(q);
          const matchProd = prod.name.toLowerCase().includes(q);
          const matchBrand = (prod.principalName || "").toLowerCase().includes(q);
          if (!matchCust && !matchProd && !matchBrand) return false;
        }

        if (lineChip === "projected" && !(p.projectedQty > 0)) return false;
        if (lineChip === "blank" && p.projectedQty > 0) return false;
        if (lineChip === "due") {
          if (!p.nextFollowUp || p.nextFollowUp > todayStr) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const ca = custLookup.get(a.customerId);
        const cb = custLookup.get(b.customerId);
        const rankDiff = (CAT_RANK[ca?.tier || ""] ?? 4) - (CAT_RANK[cb?.tier || ""] ?? 4);
        if (rankDiff !== 0) return rankDiff;
        if (ca?.name !== cb?.name) return (ca?.name || "").localeCompare(cb?.name || "");
        const pa = prodLookup.get(a.productId);
        const pb = prodLookup.get(b.productId);
        return (pa?.name || "").localeCompare(pb?.name || "");
      });
  }, [
    projections,
    month,
    role,
    ownerId,
    ownerFilter,
    principalId,
    search,
    lineChip,
    custLookup,
    prodLookup,
    todayStr,
  ]);

  // Summary footer calculations (on all matching rows)
  const totLines = visibleProjections.length;
  const totCommitted = visibleProjections.reduce((s, p) => s + (p.projectedQty || 0) * (p.price || 0), 0);
  const totAchieved = visibleProjections.reduce((s, p) => s + (p.achievedQty || 0) * (p.price || 0), 0);
  const totPct = totCommitted > 0 ? (totAchieved / totCommitted) * 100 : null;

  // Pagination slicing
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totLines / pageSize);
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));

  const paginatedProjections = useMemo(() => {
    if (pageSize === 0) return visibleProjections;
    const start = (validCurrentPage - 1) * pageSize;
    return visibleProjections.slice(start, start + pageSize);
  }, [visibleProjections, validCurrentPage, pageSize]);

  // Reset to page 1 on filter/search changes
  const handleSearch = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };
  const handleChip = (val: LineFilter) => {
    setLineChip(val);
    setCurrentPage(1);
  };

  // Callbacks for memoized rows
  const handleOpenCustomer = useCallback((id: string) => setSelectedDrawerCustId(id), []);
  const handleOpenRemarks = useCallback((p: Projection) => setSelectedRemarksProj(p), []);
  const handleOpenFollowUp = useCallback((p: Projection) => setSelectedFuProj(p), []);
  const handleCreateSo = useCallback((p: Projection) => setCreateSoProj(p), []);
  const handleViewSo = useCallback((so: SalesOrder) => setViewSo(so), []);

  const handleUpdateCell = useCallback(
    (id: string, field: "price" | "projectedQty" | "achievedQty" | "status" | "nextFollowUp" | "targetDate", value: any) => {
      updateProjectionCell(id, field, value);
    },
    [updateProjectionCell]
  );

  const handleChangePrincipal = useCallback(
    (id: string, principalId: string) => {
      changeProjectionPrincipal(id, principalId);
      toast.info("Principal updated");
    },
    [changeProjectionPrincipal]
  );

  const handleChangeProduct = useCallback(
    (id: string, productId: string) => {
      changeProjectionProduct(id, productId);
      toast.info("Product SKU updated");
    },
    [changeProjectionProduct]
  );

  const handleDelete = useCallback(
    (id: string, name?: string) => {
      if (confirm(`Remove mapping for ${name || "this line"}?`)) {
        deleteProjection(id);
        toast.info("SKU mapping removed");
      }
    },
    [deleteProjection]
  );

  // CSV Export
  const exportCsv = () => {
    const headers = [
      "#",
      "Customer",
      "Principal",
      "Sub Product",
      "Salesperson",
      "Price",
      "Proj Qty",
      "Proj Value",
      "Ach Qty",
      "Ach Value",
      "Ach %",
      "Status",
      "Next follow-up",
      "Expected closure",
      "Sales Order Status",
    ];

    const rows = visibleProjections.map((p, i) => {
      const c = custLookup.get(p.customerId);
      const pr = prodLookup.get(p.productId);
      const u = userLookup.get(p.ownerId);
      const pv = p.projectedQty && p.price ? p.projectedQty * p.price : 0;
      const av = p.achievedQty && p.price ? p.achievedQty * p.price : 0;
      const so = p.salesOrderId ? orderLookup.get(p.salesOrderId) : undefined;

      return [
        i + 1,
        c?.name || "",
        pr?.principalName || "",
        pr?.name || "",
        u?.name || "",
        p.price ?? "",
        p.projectedQty ?? "",
        pv || "",
        p.achievedQty ?? "",
        av || "",
        pv ? ((av / pv) * 100).toFixed(1) + "%" : "",
        p.status || "",
        p.nextFollowUp || "",
        p.targetDate || "",
        so?.status || "",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projections_${month}.csv`;
    a.click();
    toast.success("CSV export generated successfully");
  };

  // Group by category break
  let lastCustId: string | null = null;
  let lastTier: string | null = null;
  const startIdx = pageSize === 0 ? 0 : (validCurrentPage - 1) * pageSize;

  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        {/* Worksheet Header */}
        <div className="px-4 pt-3.5 pb-2 flex items-center justify-between border-b border-line/60 bg-surface-2/30">
          <div className="text-sm font-bold text-ink">
            Recurring Sales Projections Worksheet — <span className="text-brand font-extrabold">{monthLabel}</span>
          </div>
          <div className="text-xs text-muted">
            <span className="font-semibold text-ink">{totLines}</span> active mapped rows
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search customer or product…"
            className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-64 shadow-2xs"
          />

          {/* Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "all", label: "All lines" },
              { id: "projected", label: "Projected" },
              { id: "blank", label: "Unprojected" },
              { id: "due", label: "Needs follow-up" },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => handleChip(c.id as LineFilter)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                  lineChip === c.id
                    ? "border-brand bg-brand text-white shadow-2xs"
                    : "border-line bg-surface text-muted hover:border-muted/50 hover:text-ink"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {canEdit && (
              <>
                <Button size="sm" onClick={() => setShowAddCustomer(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Customer
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddMapping(true)}>
                  <Repeat className="h-3.5 w-3.5 mr-1" /> Map SKU
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Main Projections Table */}
        <div className="overflow-x-auto max-h-[68vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
              <tr>
                <th className="py-2.5 px-3 w-10">#</th>
                <th className="py-2.5 px-3 min-w-[210px]">Customer</th>
                {showSp && <th className="py-2.5 px-3 min-w-[100px]">Salesperson</th>}
                <th className="py-2.5 px-3 min-w-[120px]">Principal</th>
                <th className="py-2.5 px-3 min-w-[200px]">Sub product</th>
                <th className="py-2.5 px-3 text-right">Price ₹</th>
                <th className="py-2.5 px-3 text-right">Proj qty</th>
                <th className="py-2.5 px-3 text-right font-bold text-ink">Proj value</th>
                <th className="py-2.5 px-3 text-right">Ach qty</th>
                <th className="py-2.5 px-3 text-right text-brand font-bold">Ach value</th>
                <th className="py-2.5 px-3 text-right">Ach %</th>
                <th className="py-2.5 px-3 min-w-[140px]">Status</th>
                <th className="py-2.5 px-3 min-w-[120px]">Next follow-up</th>
                <th className="py-2.5 px-3 min-w-[120px]">Expected closure</th>
                <th className="py-2.5 px-3 text-center">Remarks</th>
                <th className="py-2.5 px-3 text-center min-w-[110px]">Follow-up log</th>
                <th className="py-2.5 px-3 text-center min-w-[110px]">Sales order</th>
                {isAdmin && <th className="py-2.5 px-2 w-8"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {totLines === 0 ? (
                <tr>
                  <td colSpan={totalCols} className="py-16 text-center text-xs text-muted">
                    No projection lines match this filter. Click &ldquo;+ Map SKU&rdquo; to add a customer product row.
                  </td>
                </tr>
              ) : (
                paginatedProjections.map((p, pageIdx) => {
                  const globalIdx = startIdx + pageIdx;
                  const cust = custLookup.get(p.customerId);
                  const prod = prodLookup.get(p.productId);
                  const user = userLookup.get(p.ownerId);
                  const so = p.salesOrderId ? orderLookup.get(p.salesOrderId) : undefined;

                  const isNewCust = p.customerId !== lastCustId;
                  lastCustId = p.customerId;

                  const tierName = cust?.tier || "Unclassified";
                  const showTierBreak = isNewCust && cust?.tier !== lastTier;
                  if (isNewCust) lastTier = cust?.tier || null;

                  const principalProds = prod ? prodsByPrincipal.get(prod.principalId) || [] : [];

                  return (
                    <ProjectionRow
                      key={p.id}
                      projection={p}
                      idx={globalIdx}
                      customer={cust}
                      product={prod}
                      user={user}
                      salesOrder={so}
                      principals={principals}
                      principalProds={principalProds}
                      canEdit={canEdit}
                      showSp={showSp}
                      isAdmin={isAdmin}
                      isNewCust={isNewCust}
                      showTierBreak={showTierBreak}
                      tierName={tierName}
                      totalCols={totalCols}
                      todayStr={todayStr}
                      onOpenCustomer={handleOpenCustomer}
                      onOpenRemarks={handleOpenRemarks}
                      onOpenFollowUp={handleOpenFollowUp}
                      onCreateSo={handleCreateSo}
                      onViewSo={handleViewSo}
                      onUpdateCell={handleUpdateCell}
                      onChangePrincipal={handleChangePrincipal}
                      onChangeProduct={handleChangeProduct}
                      onDelete={handleDelete}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Pagination Bar */}
        <div className="p-3 border-t border-line bg-surface-2 text-xs font-medium text-muted flex items-center justify-between flex-wrap gap-3">
          <div>
            Showing <b className="text-ink">{totLines}</b> lines · Committed <b className="text-ink">{inr(totCommitted)}</b> · Achieved <b className="text-brand">{inr(totAchieved)}</b> · Achievement <b className="text-ink">{totPct != null ? totPct.toFixed(1) + "%" : "—"}</b>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink font-semibold"
              >
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={200}>200 per page</option>
                <option value={0}>Show all ({totLines})</option>
              </select>
            </div>

            {/* Pagination Navigation Buttons */}
            {pageSize > 0 && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted mr-1">
                  Page <b className="text-ink">{validCurrentPage}</b> of <b className="text-ink">{totalPages}</b>
                </span>
                <button
                  type="button"
                  disabled={validCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Customer 360 Drawer */}
      <CustomerDrawer
        customerId={selectedDrawerCustId}
        onClose={() => setSelectedDrawerCustId(null)}
      />

      {/* Modals */}
      <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
      <AddMappingModal open={showAddMapping} onClose={() => setShowAddMapping(false)} />

      {selectedRemarksProj && (
        <RemarksModal
          open={!!selectedRemarksProj}
          onClose={() => setSelectedRemarksProj(null)}
          title={`Remarks — ${custLookup.get(selectedRemarksProj.customerId)?.name} · ${prodLookup.get(selectedRemarksProj.productId)?.name}`}
          remarks={selectedRemarksProj.remarks || []}
          onAddRemark={(text, user) => {
            addProjectionRemark(selectedRemarksProj.id, text, user);
            toast.success("Remark added");
          }}
        />
      )}

      {selectedFuProj && (
        <FollowUpModal
          open={!!selectedFuProj}
          onClose={() => setSelectedFuProj(null)}
          title={`${custLookup.get(selectedFuProj.customerId)?.name} · ${prodLookup.get(selectedFuProj.productId)?.name}`}
          subtitle={`${prodLookup.get(selectedFuProj.productId)?.principalName} · Proj ${selectedFuProj.projectedQty || 0} units @ ₹${selectedFuProj.price || 0} = ${inr((selectedFuProj.projectedQty || 0) * (selectedFuProj.price || 0))} · Achieved ${selectedFuProj.achievedQty || 0} · Status: ${selectedFuProj.status || "—"}`}
          currentDate={selectedFuProj.nextFollowUp}
          currentProb={selectedFuProj.probability}
          currentStatus={selectedFuProj.status}
          remarks={selectedFuProj.remarks || []}
          onSave={(nextDate, note, prob, nextStatus) => {
            if (note) {
              addProjectionRemark(selectedFuProj.id, note, users.find((u) => u.id === ownerId)?.name || "Sales Rep");
            }
            setProjectionFollowUp(selectedFuProj.id, nextDate, undefined, prob, nextStatus);
            toast.success("Follow-up saved");
          }}
        />
      )}

      {createSoProj && (
        <CreateSalesOrderModal
          open={!!createSoProj}
          onClose={() => setCreateSoProj(null)}
          initialCustomerId={createSoProj.customerId}
          initialProductId={createSoProj.productId}
          initialQty={createSoProj.achievedQty || createSoProj.projectedQty || 10}
          initialPrice={createSoProj.price}
          fromProjectionId={createSoProj.id}
        />
      )}

      {viewSo && (
        <SalesOrderDetailModal open={!!viewSo} onClose={() => setViewSo(null)} order={viewSo} />
      )}
    </div>
  );
}

