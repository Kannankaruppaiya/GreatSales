-- CreateTable
CREATE TABLE "PeriodLock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "reason" TEXT,
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeriodLock_tenantId_idx" ON "PeriodLock"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodLock_tenantId_period_key" ON "PeriodLock"("tenantId", "period");

-- AddForeignKey
ALTER TABLE "PeriodLock" ADD CONSTRAINT "PeriodLock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodLock" ADD CONSTRAINT "PeriodLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
