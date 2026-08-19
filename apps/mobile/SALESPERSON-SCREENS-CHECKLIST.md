# GreatSales Mobile — Salesperson Screens Checklist

> The mobile app is the **salesperson** surface (offline-first, field use). The web
> console keeps **Admin + Management** only; the salesperson frontend is optimized
> specifically for on-the-go mobile workflows.
>
> Source of truth for *what a salesperson sees* = the domain model in
> `apps/web/src/data/{types,constants}.ts` and `apps/mobile/src/gs/domain.ts`.
>
> Legend: ✅ done · 🔜 future backend/native integration

---

## Navigation shell  ✅
- [x] Bottom tab bar (5): **Home · Projections · Leads · Follow-ups · More**
- [x] Secondary screens reachable from **More**: Sales Orders · Payments · My Customers · Profile
- [x] Login screen (salesperson persona) as the entry gate
- [x] Safe-area aware, light theme, GreatSales emerald brand (`#059669`)
- [x] INR / lakh money formatting, tabular figures, Indian date format

---

## 1. Login  ✅
- [x] Brand lockup + tagline
- [x] Tenant / email / password fields
- [x] "Sign in" → enters the app with persona state
- [x] Salesperson persona note

## 2. Home / Dashboard  ✅
- [x] Greeting + current fiscal month
- [x] KPI tiles: Recurring committed · Recurring achieved · Total committed · Total achieved · Achievement % · Follow-ups due
- [x] Quick actions: New Lead · Add Customer · Create Order
- [x] Today's follow-ups (count + peek)
- [x] My deals at **Oral Confirmation** (high-probability hot deals)
- [x] Top open projections this month
- [x] Pull-to-refresh (`RefreshControl`)

## 3. Recurring Projections  ✅
- [x] Month context + summary bar (Committed · Achieved · Achievement %)
- [x] Filter tabs: All / Projected / Unprojected / Needs follow-up (counts)
- [x] Line rows: Customer · Product/Principal · Proj qty · Achieved qty · Value · Confidence % · Status · Next follow-up
- [x] Semantic status + confidence colour (won/hot/open/lost)
- [x] Inline edit line rate, quantities, status & expected closure
- [x] Log follow-up modal with mode, confidence % and next date
- [x] Remarks history and quick additions
- [x] 1-tap Create Sales Order directly from confirmed projection lines
- [x] CSV export via native Share dialog

## 4. New Sales Customers (Leads)  ✅
- [x] Pipeline stage strip with per-stage counts (9 deal stages)
- [x] Stage filter chips + search bar
- [x] List mode and Kanban visual board toggle
- [x] Lead cards: Name · Tier · Deal value · Stage · Days-in-stage (stale >14d) · Next follow-up · Contact · Area
- [x] Lead detail sheet with stage advance pills and remark thread
- [x] Add New Lead form with multi-product & principal rate rows

## 5. Sales Orders  ✅
- [x] Order rows: Code · Customer · Status (6-stage lifecycle) · Value · Expected delivery · Urgent flag
- [x] Status tone (created/in-progress/received/cancelled)
- [x] Delivery partner assignment & cancel reason modal
- [x] Interactive Order Timeline (6 milestone steps with timestamps)
- [x] Fulfilment report: Total orders, Delivered, In-flight, Avg ack/prep/transit/total duration KPIs

## 6. Payments Follow-up  ✅
- [x] Ageing summary buckets + pay-zone chips (Green/Yellow/Red/Blacklist)
- [x] Rows: Customer · Invoice · Amount · Pending · Due date · Aging days · Zone · Next follow-up
- [x] Overdue days calculation and danger highlight
- [x] Collection notes thread and follow-up date picker
- [x] 4-stage reminder mail tracker (Mail 1 to 4)

## 7. Follow-ups  ✅
- [x] Grouped agenda: **Overdue · Today · Upcoming**
- [x] Item: Title · Subtitle · Kind (projection/lead/payment) · Due date · Amount
- [x] Overdue count emphasis and status dot indicators

## 8. My Customers  ✅
- [x] Rows: Name · Tier · Area · Industry · Outstanding · Pay-zone · Contact
- [x] Search + tier filter chips
- [x] Direct native Call (`tel:`) and WhatsApp (`wa.me`) deep links
- [x] Add Customer form with dynamic principal & sub-product pricing mappings

## 9. More / Profile  ✅
- [x] Direct shortcuts to Sales Orders, Payments, My Customers, and Profile
- [x] Profile card: avatar, name, role, region, and target achievement summary
- [x] Safe Sign out action (returns to login screen)
- [x] App version & copyright info

---

## Domain vocabulary (mirrors the business language)
- **Customer tiers:** Platinum · Gold · Silver · Brass
- **Pay zones:** Green · Yellow · Red · Blacklist
- **Projection statuses (13):** Projection Created → … → Confirmed / Completed / Lost / Cancelled
- **Deal stages (9):** New Enquiries · Needs Analysis · Trials & Sample Tests · Proposals & Price Quote · Negotiation / Oral Confirmation · Closed Won · Closed Lost · No Requirement or Cold · Trial Problem
- **Sales-order lifecycle (6+cancel):** Created → Acknowledged → Delivery Partner Assigned → Delivered from Warehouse → Delivered to Customer → Customer Receipt Confirmed
- **Divisions:** LUB · WES · **Money:** INR, lakh/crore scale
