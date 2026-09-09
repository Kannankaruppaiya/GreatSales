# GreatSales Mobile — Design System, UI Principles & Web-Parity Guidelines

> **Scope:** This document serves as the official mobile design contract for GreatSales Mobile (`apps/mobile`).
> It defines the visual tokens, typography scale, 5-zone layout architecture, component standards,
> touch ergonomics (Apple HIG), and the screen-by-screen specification required to achieve 100% feature
> parity with the GreatSales Web console.

---

# 1. VISUAL PHILOSOPHY: EMERALD EXECUTIVE

GreatSales Mobile is engineered for industrial sales executives, managers, and field sales teams.
The aesthetic combines **OLED precision**, **crisp cloud canvas**, and **emerald executive authority**
to provide high density without visual clutter.

### Core Principles
1. **No AI Slop / Generic Templates**: No heavy purple-blue gradients, no vague translucent frosted blobs that hurt readability, no generic 3-column desktop ports.
2. **Double-Bezel Machined Architecture**: Cards, containers, and inputs feel like precision hardware with concentric borders (`rounded-2xl` outer, `rounded-xl` inner).
3. **One-Handed Field Ergonomics**: Primary action triggers sit within the lower 60% thumb-reach zone. Complex creation flows use full/half **Bottom Sheets** instead of centered desktop modals.
4. **Instant Action Triggers**: Phone numbers trigger direct `tel:` calls, WhatsApp triggers direct chat with pre-filled context, and maps trigger native navigation pins.

---

# 2. COLOR SYSTEM & SEMANTIC TOKENS

The color palette is calibrated for high sunlight outdoor readability and indoor executive review (WCAG 2.2 AA/AAA compliant).

### Surface & Canvas Tokens
| Token | Hex | Tailwind / Style | Usage |
| :--- | :--- | :--- | :--- |
| **`canvas`** | `#f8fafc` | `bg-canvas` / Slate-50 | Primary application screen background |
| **`canvasSubtle`** | `#f1f5f9` | `bg-surface2` / Slate-100 | Secondary panels, search bars, inactive chips |
| **`surface`** | `#ffffff` | `bg-surface` / White | Cards, Bottom sheets, Input containers, Action sheets |
| **`surface3`** | `#e2e8f0` | `bg-surface3` / Slate-200 | Dividers, tab track background, table headers |
| **`line`** | `#e2e8f0` | `border-line` | 1px clean hairline border for cards and dividers |
| **`lineDark`** | `#cbd5e1` | `border-lineDark` | Active borders, input hover/focus borders |

### Typography Colors
| Token | Hex | Usage |
| :--- | :--- | :--- |
| **`ink`** | `#0f172a` | Primary titles, company names, key metric figures (Highest contrast) |
| **`ink2`** | `#1e293b` | Section headings, list item titles, form values |
| **`body`** | `#334155` | Descriptions, addresses, remarks |
| **`muted`** | `#64748b` | Meta labels, timestamps, due dates, secondary tags |
| **`faint`** | `#94a3b8` | Placeholder text, disabled labels, micro icons |

### Semantic Brand & Status Accents
| Semantic Tone | Primary (FG) | Soft Background | Border | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Emerald (Brand/Won)** | `#059669` | `#ecfdf5` | `#a7f3d0` | Primary actions, Won deals, Achieved targets, Active status |
| **Amber (Hot/In-Progress)** | `#d97706` | `#fffbeb` | `#fde68a` | Oral confirmation, In-transit orders, Urgent tasks, Hot leads |
| **Red (Critical/Overdue/Lost)** | `#dc2626` | `#fef2f2` | `#fecaca` | Overdue collections (>90d), Cancelled orders, Deletions |
| **Blue (Info/Pipeline)** | `#2563eb` | `#eff6ff` | `#bfdbfe` | Open proposals, Phone links, Customer inquiries |
| **Violet (Premium/Mapping)** | `#7c3aed` | `#f5f3ff` | `#ddd6fe` | Customer product mappings, Special discounts, Brand masters |

---

# 3. TYPOGRAPHY HIERARCHY

Optimized for high-density B2B mobile CRM screens (Font: *Plus Jakarta Sans* / *System SF Pro* / *Roboto*).

| Level | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | `24px` | 900 (Black) | `28px` | Executive KPI figures, Monthly achievement total |
| **Screen Title** | `20px` | 900 (Black) | `24px` | Top-level screen headers in Zone 1 |
| **Section Header** | `15px` | 800 (Bold) | `20px` | Customer name, Sales Order number, Lead title |
| **Body / Value** | `13px` | 700 / 600 | `18px` | Rupees amounts (`₹ Lakhs`), Phone, Location, Notes |
| **Meta / Subtitle** | `11px` | 700 / 600 | `14px` | Timestamps, Due dates, Rep name, Category tier |
| **Micro Badge** | `10px` | 800 (ExtraBold)| `12px` | Status chips, Category pills (`UPPERCASE`, `tracking-wide`) |

---

# 4. 5-ZONE MOBILE LAYOUT ARCHITECTURE

Every primary screen in the GreatSales Mobile application adheres strictly to the **5-Zone Layout**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ZONE 1: STICKY TOP BAR                                                 │
│ • Back Navigation / Breadcrumb (e.g. "‹ Dashboard")                    │
│ • Screen Title (20px Black)                                            │
│ • Primary Contextual Action Button (e.g. "+ Order", "+ Prospect")      │
├────────────────────────────────────────────────────────────────────────┤
│ ZONE 2: KPI SUMMARY STRIP                                              │
│ • 4-Column Compact Metric Cards (Total, In-Progress, Alert, Completed) │
├────────────────────────────────────────────────────────────────────────┤
│ ZONE 3: SEARCH & INTERACTIVE FILTER TOOLBAR                            │
│ • Debounced Search Input with 'X' clear button                         │
│ • Horizontal Scrollable Filter Chips (Status, Category, Owner, Sector) │
│ • View Mode Switchers (e.g. List / Kanban / SLA Report)                │
├────────────────────────────────────────────────────────────────────────┤
│ ZONE 4: VIRTUALIZED CONTENT STREAM                                     │
│ • Double-bezel interactive cards (`p-3.5 rounded-2xl bg-surface`)      │
│ • Quick-action triggers (Call, WhatsApp, Maps, Status Step Advance)    │
│ • Pull-to-Refresh & Infinite Scroll Loading Footer                     │
├────────────────────────────────────────────────────────────────────────┤
│ ZONE 5: DYNAMIC BOTTOM NAVIGATION & SAFE INSET BAR                     │
│ • Safe Area Inset Handling (iOS gesture bar / Android nav bar)         │
│ • High-contrast 5-Tab Navigation with active indicator dot             │
└────────────────────────────────────────────────────────────────────────┘
```

---

# 5. TOUCH ERGONOMICS & COMPONENT STANDARDS (APPLE HIG)

1. **44×44pt Minimum Touch Target**:
   - Every tappable icon, chip, button, or checkbox must provide at least 44×44pt hit-slop (`hitSlop={12}`).
2. **Double-Bezel Card Container**:
   - Outer wrapper: `bg-surface border border-line rounded-2xl p-3.5 shadow-xs`.
   - Nested sub-containers: `bg-surface2 rounded-xl p-2.5 border border-line/60`.
3. **Bottom Sheets Over Centered Modals**:
   - Mobile forms and deep inspections must open from the bottom with grab handles, swipe-to-dismiss, and keyboard avoidance.
4. **Direct Telephony & WhatsApp Hooks**:
   - Phone link: `Linking.openURL('tel:' + phone)`
   - WhatsApp link: `Linking.openURL('https://wa.me/91' + phone.replace(/\D/g, ''))`
   - Map link: `Linking.openURL(mapsUrl(address, lat, lng))`

---

# 6. WEB-PARITY SPECIFICATION & SCREEN MATRIX

This section specifies every screen in GreatSales Mobile and the exact missing options to bring to parity with Web.

| Screen / File | Current Mobile State | Web Features Required for 100% Parity |
| :--- | :--- | :--- |
| **Dashboard**<br>`(app)/index.tsx` | Target, Achieved, Oral deals, Follow-ups list | • Principal brand volume & revenue breakdown table<br>• Salesperson leaderboard & shortfall indicator<br>• One-click shortcut triggers (`+ Order`, `+ Lead`) |
| **Sales Orders**<br>`(app)/orders.tsx` | View orders, SLA tab, Status timeline advance | 🚨 **Create Sales Order Modal** (Multi-item line picker with SKU, quantity, unit price, discount %, tax, net total calculation)<br>• Salesperson owner filter<br>• Print / Share Order summary sheet |
| **My Customers**<br>`(app)/customers.tsx` | Basic search, Tier chips, Simple remark sheet | • **5-Tab Customer Detail Drawer** (Overview, Orders History, Ledger & Invoices, Follow-ups, Mappings)<br>• **Multi-Filters**: Industrial Area, Industry Sector, Salesperson Owner<br>• **Reassign Customer Owner Modal** |
| **New Sales / Leads**<br>`(app)/leads.tsx` | List & Kanban, Single-value Add prospect | • **Multi-Product Requirement Picker** in Add Lead form (SKU, qty, expected rate)<br>• Industry Sector & Salesperson Owner filters<br>• Direct 1-Click Conversion: Lead → Sales Order |
| **Projections**<br>`(app)/projections.tsx` | Monthly projection cards, status updater | • **Period Lock Banner** (shows locked status, who locked, timestamp)<br>• Principal brand summary breakdown card<br>• Salesperson summary card |
| **Payments / Receivables**<br>`(app)/payments.tsx` | Outstanding list, Add collection modal | • **Aging Analysis Summary Strip** (0-30d, 31-60d, 61-90d, 90+ days overdue)<br>• Pay-Zone filter chips (Green, Yellow, Red, Blacklist)<br>• Salesperson Owner filter |
| **Customer Mappings**<br>`(app)/mappings.tsx` | Customer × Product pricing matrix, Add mapping | • Principal brand filter<br>• Product division filter<br>• Bulk mapping edit / discount rate update |
| **Products & Brands Catalog**<br>`(app)/products.tsx` *(NEW)* | ❌ *Missing in mobile* | • **Principal Brands Master Card** (Brand logos, principal distributor names)<br>• **Product Master List** (SKU, category, division, pack size, unit price)<br>• Principal brand filter & Division filter<br>• Add / Edit Product modal |
| **More Hub**<br>`(app)/more.tsx` | Basic links to Orders, Payments, Customers | • Add direct navigation tiles to **Products & Brands Catalog**<br>• Add Team performance summary widget |

---

# 7. MOTION, FEEDBACK & PERFORMANCE GUARDRAILS

1. **Restrained Micro-Animations (Emil Kowalski Standard)**:
   - Button tap scale: `active:scale-[0.98]` with `active:opacity-85`.
   - Transitions duration: `150ms - 220ms` using standard ease/spring.
2. **Optimistic State Updates**:
   - Toggle follow-up complete, advance order status, and update projection status immediately in local React Query cache while mutation executes in background.
3. **Performance & Safe Rendering**:
   - Use `FlatList` with `windowSize={5}`, `maxToRenderPerBatch={10}`, and `initialNumToRender={8}` for smooth 60fps scrolling on low-end mobile hardware.
   - Never use unbounded `.map()` over hundreds of database records.

---
