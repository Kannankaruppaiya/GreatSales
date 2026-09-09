# GreatSales Mobile — Design System, UI Principles & Web-Parity Guidelines

> **Scope:** Official design contract for GreatSales Mobile (`apps/mobile`).
> For full specifications, see [MOBILE_DESIGN.md](../../MOBILE_DESIGN.md) at the repository root.

---

# 1. CORE TOKENS SUMMARY

- **Canvas Background**: `#f8fafc` (Slate 50)
- **Card / Sheet Surface**: `#ffffff` (Pure White)
- **Primary Brand**: `#059669` (Emerald 600) | Soft: `#ecfdf5` | Border: `#a7f3d0`
- **Amber Warning / Hot**: `#d97706` | Soft: `#fffbeb` | Border: `#fde68a`
- **Red Critical / Overdue**: `#dc2626` | Soft: `#fef2f2` | Border: `#fecaca`
- **Blue Info**: `#2563eb` | Soft: `#eff6ff` | Border: `#bfdbfe`
- **Violet Mapping**: `#7c3aed` | Soft: `#f5f3ff` | Border: `#ddd6fe`
- **Ink (Text)**: `#0f172a` (Headings) | `#64748b` (Muted) | `#94a3b8` (Faint)
- **Border / Line**: `#e2e8f0` (1px Solid)

---

# 2. 5-ZONE LAYOUT ARCHITECTURE

1. **Zone 1: Sticky Top Bar** — Page Title, Back Breadcrumb, Primary Action Button (`+ Action`).
2. **Zone 2: KPI Strip** — 4-Column quick metric cards (Total, In-Progress, Alert, Completed).
3. **Zone 3: Search & Filter Toolbar** — Debounced search input, horizontal scroll filter chips, view mode tabs.
4. **Zone 4: Content Stream** — Double-bezel cards (`rounded-2xl`), interactive quick action buttons (Call/WhatsApp/Advance), pull-to-refresh.
5. **Zone 5: Safe Insets & Bottom Navigation** — iOS Home indicator & Android navigation bar aware tab bar.

---

# 3. WEB-PARITY ESSENTIALS

1. **Orders**: Add *Create Sales Order Modal* with multi-item picker & live calculation.
2. **Customers**: Add *5-Tab Detail Drawer* (Overview, Orders, Ledger, Follow-ups, Mappings), *Reassign Owner*, and Area/Industry/Owner filters.
3. **Leads**: Add *Multi-Product Requirement Picker* and direct *Lead → Order Conversion*.
4. **Products**: Add new `products.tsx` screen for Principal Brands and Product Catalog Master.
5. **Payments**: Add *Aging Buckets Analysis* (0-30d, 31-60d, 61-90d, 90+d) and Pay-Zone filters.
6. **Projections**: Add *Period Lock Banner* and Principal/Salesperson summary cards.
