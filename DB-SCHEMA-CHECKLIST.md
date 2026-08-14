# GreatSales CRM — DB Schema Checklist

> What data must be present in the DB, how it's modeled, with all POC gaps filled.
> Build target: `packages/db/prisma/schema.prisma` (PostgreSQL + Prisma).
> Legend: 🆕 = gap-fill (not in POC) · 🔒 = tenant-scoped · ⟳ = sync-ready fields

---

## 0. Cross-cutting rules (EVERY table)
- [ ] `id` — cuid/uuid primary key
- [ ] `tenantId` 🔒 — on all tenant-owned tables (multi-tenancy) 🆕
- [ ] `createdAt`, `updatedAt` — timestamps
- [ ] `deletedAt` — soft delete ⟳ (offline/audit)
- [ ] `version` / `updatedAt` — sync conflict field ⟳
- [ ] Indexes on `tenantId`, FKs, and common filter columns (period, salespersonId)
- [ ] RLS enabled — tenant isolation + role/team scoping (Postgres policies)
- [ ] Unique constraints where needed (email, username, invoiceNo per tenant)

---

## 1. Tenant & Org

### Tenant 🆕
- [ ] id, name, plan, limits(json), config(json), createdAt
- [ ] `plan` + `limits` = billing-ready fields (Stripe later)

### User
- [ ] id, tenantId🔒, name, email, username, passwordHash
- [ ] roleId→Role, managerId→User(self) 🆕, teamId→Team 🆕
- [ ] active, lastIp, lastLoginAt
- [ ] unique(email per tenant), unique(username per tenant)

### Team 🆕 (hierarchy gap)
- [ ] id, tenantId🔒, name, managerId→User
- [ ] User.teamId links salespersons → team → manager

### Role 🆕 (granular RBAC gap)
- [ ] id, tenantId🔒, name, isSystem(bool)

### Permission 🆕
- [ ] id, key (e.g. "customer.create"), module

### RolePermission 🆕
- [ ] roleId→, permissionId→ (composite unique)

---

## 2. Customers

### Customer 🔒
- [ ] id, tenantId, name, category(Platinum/Gold/Silver/Brass)
- [ ] industryId→Industry, subIndustry, area(industrial area)
- [ ] paymentTerms(enum), payZone(Red/Yellow/Green/Blacklist)
- [ ] salespersonId→User
- [ ] index(salespersonId), index(category)

### CustomerContact 🆕 (multi-contact gap)
- [ ] id, customerId→, name, designation, phone, email, isPrimary(bool)

### Industry (master)
- [ ] id, name, subIndustries(json) — from POC taxonomy

---

## 3. Products & Principals

### Principal 🔒
- [ ] id, tenantId, name

### Product 🔒
- [ ] id, tenantId, principalId→, name, unit, basePrice

### Mapping 🔒 (recurring customer↔product)
- [ ] id, tenantId, customerId→, productId→, salespersonId→
- [ ] unique(customerId, productId)

---

## 4. Targets & Projections (CORE)

### SalesTarget 🆕 (target gap)
- [ ] id, tenantId🔒, salespersonId→, period(YYYY-MM), targetValue
- [ ] unique(salespersonId, period)

### Projection 🔒 (monthly line)
- [ ] id, tenantId, mappingId→, period(YYYY-MM)
- [ ] committedQty, achievedQty, price, status(deal stage)
- [ ] unique(mappingId, period)
- [ ] index(period)
- [ ] → Target vs Committed vs Achieved = 3-way (POC had 2)

---

## 5. Leads (new sales)

### Lead 🔒
- [ ] id, tenantId, customerName, salespersonId→
- [ ] stage(9 stages enum), leadStatus(Platinum/Gold/Silver/Bronze)
- [ ] industryId→, area

### LeadProduct
- [ ] id, leadId→, productName, brand, value

### LeadActivity (timeline)
- [ ] id, leadId→, date, note

---

## 6. Orders & Payments

### SalesOrder 🔒
- [ ] id, tenantId, customerId→, salespersonId→, date, status, total

### SalesOrderItem
- [ ] id, orderId→, productId→, qty, price

### OrderStatusHistory
- [ ] id, orderId→, status, changedBy→, at

### Payment 🔒
- [ ] id, tenantId, customerId→, invoiceNo, amount, dueDate
- [ ] agingDays(computed), payZone, status
- [ ] unique(invoiceNo per tenant)

### PaymentFollowup
- [ ] id, paymentId→, date, note, nextFollowupDate

---

## 7. Cross-cutting entities

### FollowUp 🔒
- [ ] id, tenantId, entityType, entityId, salespersonId→, dueDate, done, note
- [ ] index(dueDate, done)

### Activity 🆕 (timeline gap)
- [ ] id, tenantId🔒, entityType, entityId, userId→, type, note, at

### Notification 🆕
- [ ] id, tenantId🔒, userId→, type, title, body, read, at

### Attachment 🆕 (file gap)
- [ ] id, tenantId🔒, entityType, entityId, s3Key, fileName, size, uploadedBy→

### AuditLog 🆕 (audit gap)
- [ ] id, tenantId🔒, userId→, action, entity, entityId, before(json), after(json), at

### ImportJob 🆕
- [ ] id, tenantId🔒, type, status, total, errors(json)

---

## 8. Enums to define
- [ ] CustomerCategory (Platinum, Gold, Silver, Brass)
- [ ] PaymentTerms (Immediate, 15/30/45 Days Credit, COD, Advance)
- [ ] DealStage (9 stages)
- [ ] LeadStatus (Platinum, Gold, Silver, Bronze)
- [ ] PayZone (Red, Yellow, Green, Blacklist)
- [ ] OrderStatus, FollowUpEntityType, ActivityType, NotificationType

---

## 9. Gaps filled — verification (POC → real)
- [x] 🆕 Multi-tenancy (Tenant + tenantId everywhere)
- [x] 🆕 Manager→Team→Salesperson hierarchy (Team, managerId, teamId)
- [x] 🆕 Granular RBAC (Role, Permission, RolePermission)
- [x] 🆕 Sales targets (SalesTarget → 3-way tracking)
- [x] 🆕 Multi-contact customers (CustomerContact)
- [x] 🆕 Activity timeline (Activity)
- [x] 🆕 File attachments (Attachment + S3)
- [x] 🆕 Audit log (AuditLog)
- [x] 🆕 Notifications (Notification)
- [x] 🆕 Import jobs (ImportJob)
- [x] 🆕 Soft-delete + sync fields (offline-ready)
- [ ] Later: Quotation, Approvals, PriceList, Location/visit (deferred)

---

## 10. Build steps
- [ ] `packages/db` package init (Prisma)
- [ ] `schema.prisma` — all models above
- [ ] Enums defined
- [ ] Relations + indexes + unique constraints
- [ ] `docker-compose.yml` — local Postgres
- [ ] First migration (`prisma migrate dev`)
- [ ] Seed script (POC demo data → rows)
- [ ] RLS policies (SQL, post-migration)
- [ ] Prisma client export from `packages/db`

---

*Checklist = spec for schema.prisma. Tick as built.*
