-- Where a customer physically is.
--
-- `area` is a human label ("Ambattur"), which a driver cannot navigate to. A
-- salesperson standing at the customer's gate pins their GPS instead, and the
-- pair of coordinates turns into an ordinary maps link anyone can open.
--
-- Nullable throughout: every existing customer has no pin, and a customer
-- nobody has visited yet legitimately never will.
ALTER TABLE "Customer"
  ADD COLUMN "latitude"           DECIMAL(10,7),
  ADD COLUMN "longitude"          DECIMAL(10,7),
  ADD COLUMN "locationAccuracyM"  INTEGER,
  ADD COLUMN "locationPinnedAt"   TIMESTAMP(3),
  ADD COLUMN "locationPinnedById" TEXT;

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_locationPinnedById_fkey"
  FOREIGN KEY ("locationPinnedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- A pin is meaningless unless it is on Earth, and a half-written pin (one
-- coordinate without the other) would render as a point in the Gulf of Guinea
-- rather than as an error. Both are cheaper to refuse here than to detect later.
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_location_valid" CHECK (
    ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude"  IS NULL OR ("latitude"  BETWEEN -90  AND 90))
    AND ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180))
  );

CREATE INDEX "Customer_locationPinnedById_idx" ON "Customer"("locationPinnedById");
