
-- CreateEnum
CREATE TYPE "Division" AS ENUM ('LUB', 'WES');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('Existing', 'New');

-- CreateEnum
CREATE TYPE "ProjStatus" AS ENUM ('ProjectionCreated', 'FollowUpPending', 'CustomerInterested', 'WaitingApproval', 'POExpected', 'POReceived', 'OrderPlaced', 'PartiallyConfirmed', 'Confirmed', 'Completed', 'DeferredToNextMonth', 'Lost', 'Cancelled');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('TransportLR', 'Courier', 'CompanyVehicle', 'CustomerPickup', 'HandDelivery');

-- AlterEnum
ALTER TYPE "PaymentTerms" ADD VALUE 'Advance50Balance';

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('Created', 'Acknowledged', 'DeliveryPartnerAssigned', 'DeliveredFromWarehouse', 'DeliveredToCustomer', 'CustomerReceiptConfirmed', 'Cancelled');
ALTER TABLE "SalesOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SalesOrder" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "SalesOrder" ALTER COLUMN "status" SET DEFAULT 'Created';
COMMIT;

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_customerId_fkey";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "collectorId" TEXT,
ADD COLUMN     "division" "Division",
ADD COLUMN     "outstanding" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "type" "CustomerType";

-- AlterTable
ALTER TABLE "CustomerContact" ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "sameAsMobile" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "division" "Division",
ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "Mapping" ADD COLUMN     "customPrice" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Projection" ADD COLUMN     "customPrice" DECIMAL(14,2),
ADD COLUMN     "nextFollowUp" TIMESTAMP(3),
ADD COLUMN     "probability" INTEGER,
ADD COLUMN     "salesOrderId" TEXT,
ADD COLUMN     "targetDate" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "ProjStatus" NOT NULL DEFAULT 'ProjectionCreated';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "division" "Division",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "expClose" TIMESTAMP(3),
ADD COLUMN     "nextFollowUp" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sameAsMobile" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "stageUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "subIndustry" TEXT,
ADD COLUMN     "tier" "CustomerCategory",
ADD COLUMN     "type" "CustomerType",
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "LeadProduct" ADD COLUMN     "price" DECIMAL(14,2),
ADD COLUMN     "principalId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "qty" DECIMAL(14,2),
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "advanceAmount" DECIMAL(14,2),
ADD COLUMN     "advanceRef" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryInstructions" TEXT,
ADD COLUMN     "deliveryMode" "DeliveryMode",
ADD COLUMN     "expectedDelivery" TIMESTAMP(3),
ADD COLUMN     "isUrgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lrNumber" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "transporterName" TEXT,
ALTER COLUMN "status" SET DEFAULT 'Created';

-- AlterTable
ALTER TABLE "SalesOrderItem" ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "OrderStatusHistory" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "delayReason" TEXT,
ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ADD COLUMN     "mail1" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mail2" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mail3" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mail4" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextFollowUp" TIMESTAMP(3),
ADD COLUMN     "pending" DECIMAL(14,2),
ADD COLUMN     "received" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refNo" TEXT,
ADD COLUMN     "salespersonId" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL,
ALTER COLUMN "invoiceNo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN     "amount" DECIMAL(14,2),
ADD COLUMN     "subtitle" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "Remark" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "text" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Remark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Remark_tenantId_idx" ON "Remark"("tenantId");

-- CreateIndex
CREATE INDEX "Remark_entityType_entityId_idx" ON "Remark"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Customer_collectorId_idx" ON "Customer"("collectorId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "Projection_salesOrderId_idx" ON "Projection"("salesOrderId");

-- CreateIndex
CREATE INDEX "LeadProduct_principalId_idx" ON "LeadProduct"("principalId");

-- CreateIndex
CREATE INDEX "LeadProduct_productId_idx" ON "LeadProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_tenantId_code_key" ON "SalesOrder"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Payment_salespersonId_idx" ON "Payment"("salespersonId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projection" ADD CONSTRAINT "Projection_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadProduct" ADD CONSTRAINT "LeadProduct_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadProduct" ADD CONSTRAINT "LeadProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remark" ADD CONSTRAINT "Remark_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remark" ADD CONSTRAINT "Remark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================
-- RLS for the new Remark table (direct tenantId column).
-- Mirrors the tenant_isolation pattern from 20260815000000_rls_policies.
-- greatsales_app already inherits DML grants via ALTER DEFAULT PRIVILEGES,
-- but we grant explicitly for clarity.
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON "Remark" TO greatsales_app;

ALTER TABLE "Remark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Remark" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Remark";
CREATE POLICY tenant_isolation ON "Remark"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
