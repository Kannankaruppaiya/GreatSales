import {
  PrismaClient,
  type ProjStatus,
  type DealStage,
  type OrderStatus,
  type PayZone,
  type PaymentStatus,
  type EntityType,
  type CustomerCategory,
  type Division,
} from "@prisma/client";

const prisma = new PrismaClient();
const TENANT_ID = "tenant_promech";

export const ALL_PERIODS = [
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
  "2027-01",
  "2027-02",
  "2027-03",
] as const;

function pseudoRandom(seedStr: string): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

async function main() {
  console.log("Generating comprehensive synthetic data across all 12 periods for FY 2026-2027...");

  // 1. Fetch all customer mappings and base entities
  const mappings = await prisma.mapping.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
    include: { product: true, customer: true },
  });
  console.log(`Found ${mappings.length} customer-product mappings.`);

  const customers = await prisma.customer.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
  });
  console.log(`Found ${customers.length} customers.`);

  const products = await prisma.product.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
  });
  console.log(`Found ${products.length} products.`);

  const salesUsers = await prisma.user.findMany({
    where: { tenantId: TENANT_ID, roleId: "role_sales" },
  });
  console.log(`Found ${salesUsers.length} sales reps.`);

  // 2. Populate Projections across all 12 periods
  let totalProjections = 0;

  for (const period of ALL_PERIODS) {
    const isPast = period < "2026-09";
    const isCurrent = period === "2026-09";

    const projectionData = mappings.map((m) => {
      const rand = pseudoRandom(`${m.id}-${period}`);
      const baseQty = Math.floor(rand * 8 + 2) * 20; // 40 to 200 units
      const price = m.customPrice ? Number(m.customPrice) : m.product.basePrice ? Number(m.product.basePrice) : 220;

      let achievedQty = 0;
      let status: ProjStatus = "ProjectionCreated";

      if (isPast) {
        const achRate = 0.65 + pseudoRandom(`ach-${m.id}-${period}`) * 0.35; // 65% - 100%
        achievedQty = Math.round(baseQty * achRate);
        status = achRate >= 0.9 ? "Completed" : "Confirmed";
      } else if (isCurrent) {
        const achRate = 0.2 + pseudoRandom(`ach-${m.id}-${period}`) * 0.45; // 20% - 65%
        achievedQty = Math.round(baseQty * achRate);
        status = achRate > 0.4 ? "PartiallyConfirmed" : "POReceived";
      } else {
        achievedQty = 0;
        status = rand > 0.6 ? "POExpected" : "ProjectionCreated";
      }

      return {
        tenantId: TENANT_ID,
        mappingId: m.id,
        period,
        committedQty: String(baseQty),
        achievedQty: String(achievedQty),
        price: String(price),
        status,
      };
    });

    const result = await prisma.projection.createMany({
      data: projectionData,
      skipDuplicates: true,
    });

    totalProjections += result.count;
    console.log(`Period ${period}: inserted ${result.count} projection lines.`);
  }

  // 3. Populate Sales Targets for each salesperson across all periods
  for (const user of salesUsers) {
    for (const period of ALL_PERIODS) {
      const targetVal = 1500000 + Math.floor(pseudoRandom(`target-${user.id}-${period}`) * 10) * 100000; // 15L - 25L
      await prisma.salesTarget.upsert({
        where: {
          salespersonId_period: {
            salespersonId: user.id,
            period,
          },
        },
        create: {
          tenantId: TENANT_ID,
          salespersonId: user.id,
          period,
          targetValue: String(targetVal),
        },
        update: {
          targetValue: String(targetVal),
        },
      });
    }
  }
  console.log(`Sales targets seeded for ${salesUsers.length} sales reps across all 12 periods.`);

  // 4. Populate multi-month Leads across various stages & dates
  const stages: DealStage[] = [
    "NewEnquiries",
    "NeedsAnalysis",
    "TrialsAndSampleTests",
    "ProposalsAndPriceQuote",
    "NegotiationOralConfirmation",
    "ClosedWon",
    "ClosedLost",
  ];
  const tiers: CustomerCategory[] = ["Platinum", "Gold", "Silver", "Brass"];
  const divisions: Division[] = ["LUB", "WES"];

  let leadCount = 0;
  for (let i = 0; i < 40; i++) {
    const periodIdx = i % ALL_PERIODS.length;
    const period = ALL_PERIODS[periodIdx];
    const sp = salesUsers[i % salesUsers.length];
    const stage = stages[i % stages.length];
    const tier = tiers[i % tiers.length];
    const division = divisions[i % divisions.length];
    const day = ((i * 7) % 25) + 1;
    const leadDate = new Date(`${period}-${day.toString().padStart(2, "0")}T10:00:00Z`);

    const lead = await prisma.lead.create({
      data: {
        tenantId: TENANT_ID,
        customerName: `Industrial Lead Corp ${i + 1}`,
        division,
        tier,
        type: "New",
        salespersonId: sp.id,
        stage,
        area: `Industrial Zone ${((i % 5) + 1)}`,
        contactName: `Manager ${i + 1}`,
        phone: `98765${(10000 + i).toString()}`,
        email: `lead${i + 1}@industrial-corp.com`,
        createdAt: leadDate,
        expClose: new Date(`${period}-28T18:00:00Z`),
        nextFollowUp: new Date(`${period}-15T10:00:00Z`),
        products: {
          create: [
            {
              productName: `Industrial Lub Oil ${i + 1}`,
              brand: "Castrol",
              qty: "50",
              price: "450",
              value: "22500",
            },
          ],
        },
        activities: {
          create: [
            {
              note: `Initial customer discovery meeting held for ${period}`,
              date: leadDate,
            },
          ],
        },
      },
    });
    leadCount++;
  }
  console.log(`Seeded ${leadCount} multi-month synthetic leads.`);

  // 5. Populate multi-month Sales Orders across all 12 periods
  const orderStatuses: OrderStatus[] = [
    "Created",
    "Acknowledged",
    "DeliveryPartnerAssigned",
    "DeliveredFromWarehouse",
    "DeliveredToCustomer",
    "CustomerReceiptConfirmed",
  ];

  let orderCount = 0;
  for (let i = 0; i < ALL_PERIODS.length * 5; i++) {
    const periodIdx = i % ALL_PERIODS.length;
    const period = ALL_PERIODS[periodIdx];
    const isPast = period < "2026-09";
    const status = isPast
      ? "CustomerReceiptConfirmed"
      : orderStatuses[i % orderStatuses.length];
    const customer = customers[i % customers.length];
    const sp = salesUsers[i % salesUsers.length];
    const product = products[i % products.length];
    const day = ((i * 5) % 25) + 1;
    const orderDate = new Date(`${period}-${day.toString().padStart(2, "0")}T09:00:00Z`);
    const code = `SO-${period.replace("-", "")}-${(100 + i).toString()}`;

    const existing = await prisma.salesOrder.findFirst({
      where: { tenantId: TENANT_ID, code },
    });

    if (!existing) {
      await prisma.salesOrder.create({
        data: {
          tenantId: TENANT_ID,
          code,
          customerId: customer.id,
          salespersonId: sp.id,
          date: orderDate,
          status,
          total: "125000",
          paymentTerms: "Credit30",
          deliveryMode: "TransportLR",
          items: {
            create: [
              {
                productId: product.id,
                qty: "100",
                price: "1250",
                unit: product.unit || "Ltr",
              },
            ],
          },
          statusHistory: {
            create: [
              {
                status: "Created",
                note: `Order generated for period ${period}`,
                changedById: sp.id,
                at: orderDate,
              },
            ],
          },
        },
      });
      orderCount++;
    }
  }
  console.log(`Seeded ${orderCount} multi-month sales orders across all periods.`);

  // 6. Populate multi-month Payments with various aging and payzones
  const payZones: PayZone[] = ["GreenZone", "YellowZone", "RedZone"];
  const payStatuses: PaymentStatus[] = ["Paid", "PartiallyPaid", "Pending", "Overdue"];

  let paymentCount = 0;
  for (let i = 0; i < ALL_PERIODS.length * 6; i++) {
    const periodIdx = i % ALL_PERIODS.length;
    const period = ALL_PERIODS[periodIdx];
    const customer = customers[i % customers.length];
    const sp = salesUsers[i % salesUsers.length];
    const invoiceNo = `INV-${period.replace("-", "")}-${(200 + i).toString()}`;
    const isPast = period < "2026-09";
    const status: PaymentStatus = isPast ? "Paid" : payStatuses[i % payStatuses.length];
    const payZone: PayZone = payZones[i % payZones.length];
    const amount = 85000 + (i % 10) * 15000;
    const received = status === "Paid" ? amount : status === "PartiallyPaid" ? amount / 2 : 0;
    const pending = amount - received;
    const agingDays = isPast ? 0 : (i % 90) + 15;

    const existing = await prisma.payment.findFirst({
      where: { tenantId: TENANT_ID, invoiceNo },
    });

    if (!existing) {
      await prisma.payment.create({
        data: {
          tenantId: TENANT_ID,
          refNo: `PAY-REF-${(1000 + i).toString()}`,
          customerId: customer.id,
          customerName: customer.name,
          salespersonId: sp.id,
          invoiceNo,
          invoiceDate: new Date(`${period}-05T10:00:00Z`),
          dueDate: new Date(`${period}-25T10:00:00Z`),
          amount: String(amount),
          received: String(received),
          pending: String(pending),
          agingDays,
          payZone,
          status,
          followups: {
            create: [
              {
                note: `Payment reminder sent for invoice ${invoiceNo}`,
                date: new Date(`${period}-10T10:00:00Z`),
                nextFollowupDate: new Date(`${period}-20T10:00:00Z`),
              },
            ],
          },
        },
      });
      paymentCount++;
    }
  }
  console.log(`Seeded ${paymentCount} multi-month payment records.`);

  // 7. Populate FollowUps across all months
  const allProjections = await prisma.projection.findMany({
    where: { tenantId: TENANT_ID },
    take: 100,
  });

  let followUpCount = 0;
  for (let i = 0; i < 60; i++) {
    const periodIdx = i % ALL_PERIODS.length;
    const period = ALL_PERIODS[periodIdx];
    const sp = salesUsers[i % salesUsers.length];
    const isPast = period < "2026-09";
    const day = ((i * 4) % 25) + 1;
    const dueDate = new Date(`${period}-${day.toString().padStart(2, "0")}T11:00:00Z`);

    const entityType: EntityType = i % 3 === 0 ? "Projection" : i % 3 === 1 ? "Lead" : "Payment";
    const entityId = allProjections[i % allProjections.length]?.id || `ent-${i}`;

    await prisma.followUp.create({
      data: {
        tenantId: TENANT_ID,
        entityType,
        entityId,
        salespersonId: sp.id,
        title: `Follow-up on ${entityType} #${i + 1}`,
        subtitle: `Monthly check-in for period ${period}`,
        amount: String(50000 + (i % 10) * 10000),
        dueDate,
        done: isPast ? true : i % 2 === 0,
        note: `Discuss requirement and delivery schedule for ${period}`,
      },
    });
    followUpCount++;
  }
  console.log(`Seeded ${followUpCount} multi-month follow-up records.`);

  console.log("\n================ SUMMARY OF SEEDED SYNTHETIC DATA ================");
  console.log(`✓ Projections across 12 periods: ${totalProjections}`);
  console.log(`✓ Sales Targets across 12 periods: ${salesUsers.length * ALL_PERIODS.length}`);
  console.log(`✓ Multi-month Leads: ${leadCount}`);
  console.log(`✓ Multi-month Sales Orders: ${orderCount}`);
  console.log(`✓ Multi-month Payments: ${paymentCount}`);
  console.log(`✓ Multi-month Follow-ups: ${followUpCount}`);
  console.log("==================================================================\n");
}

main()
  .catch((e) => {
    console.error("Error seeding synthetic multi-month data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
