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
  type PaymentTerms,
  type DeliveryMode,
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

// 60 Realistic Industrial Companies (Tamil Nadu & South India Automotive, Heavy Engineering, Textile, Ancillary)
const REALISTIC_COMPANIES = [
  { name: "Sundaram Auto Components Limited", area: "Hosur SIPCOT Phase-II", industry: "Automotive Ancillary", cat: "Platinum", div: "LUB" },
  { name: "Brakes India Component Division", area: "Padi Industrial Complex", industry: "Automotive Ancillary", cat: "Platinum", div: "LUB" },
  { name: "Lucas TVS Diesel Systems Plant", area: "Maraimalai Nagar Industrial Estate", industry: "Automotive Electricals", cat: "Platinum", div: "LUB" },
  { name: "Rane Brake Lining Precision Works", area: "Ambattur Industrial Estate", industry: "Automotive Ancillary", cat: "Gold", div: "LUB" },
  { name: "Wheels India Pressing Division", area: "Padi Industrial Estate", industry: "Automotive Ancillary", cat: "Platinum", div: "LUB" },
  { name: "Craftsman Automation Tooling Unit", area: "Coimbatore SIDCO Kurichi", industry: "Precision Engineering", cat: "Gold", div: "LUB" },
  { name: "Pricol Precision Instruments Ltd", area: "Coimbatore Industrial Area", industry: "Precision Engineering", cat: "Gold", div: "LUB" },
  { name: "Roots Industries India Precision", area: "Ganapathy Industrial Zone", industry: "Automotive Electricals", cat: "Silver", div: "LUB" },
  { name: "LGB Precision Rolon Chains Plant", area: "Coimbatore Textile Hub", industry: "Industrial Engineering", cat: "Gold", div: "LUB" },
  { name: "Elgi Equipments Compressors Division", area: "Singanallur Industrial Estate", industry: "Heavy Machinery", cat: "Platinum", div: "WES" },
  { name: "LMW Heavy CNC Machining Division", area: "Periyanaickenpalayam LMW Plant", industry: "Textile & CNC Machinery", cat: "Platinum", div: "WES" },
  { name: "Super Auto Forge Cold Extrusion Unit", area: "Kolathur Industrial Area", industry: "Cold Forging & Precision", cat: "Gold", div: "LUB" },
  { name: "Sakthi Auto Components Iron Foundry", area: "Pallagoundenpalayam Erode", industry: "Foundry & Castings", cat: "Platinum", div: "LUB" },
  { name: "Simpson & Co Diesel Engines Unit", area: "Sembium Industrial Hub", industry: "Engines & Heavy Power", cat: "Gold", div: "LUB" },
  { name: "Amalgamations Valeo Clutch Works", area: "Maraimalai Nagar Estate", industry: "Automotive Ancillary", cat: "Platinum", div: "LUB" },
  { name: "Mando Automotive India Chassis Plant", area: "Sriperumbudur Auto Corridor", industry: "Automotive Ancillary", cat: "Platinum", div: "LUB" },
  { name: "Hyundai Transys Gearbox Ancillary", area: "Irungattukottai SIPCOT", industry: "Automotive Transmission", cat: "Gold", div: "LUB" },
  { name: "Ashok Leyland Foundry Ancillary", area: "Ennore Industrial Corridor", industry: "Commercial Vehicles", cat: "Platinum", div: "LUB" },
  { name: "TVS Srichakra Industrial Polymers", area: "Madurai Vellaripatti Plant", industry: "Rubber & Polymers", cat: "Silver", div: "WES" },
  { name: "Kirloskar Pneumatic Works", area: "Guindy Industrial Estate", industry: "Pneumatics & Compressors", cat: "Gold", div: "WES" },
  { name: "Apex Precision Tools & Dies", area: "Ambattur Industrial Estate", industry: "Tooling & Moulds", cat: "Gold", div: "LUB" },
  { name: "Dynamic Die Castings India", area: "Guindy Industrial Estate", industry: "Die Casting & Forging", cat: "Silver", div: "LUB" },
  { name: "Titan Precision Engineering Works", area: "Hosur SIPCOT Phase-I", industry: "Precision Engineering", cat: "Platinum", div: "LUB" },
  { name: "Matrix Heavy Machining Corp", area: "Sriperumbudur Industrial Corridor", industry: "Heavy Machinery", cat: "Gold", div: "LUB" },
  { name: "Vertex Metal Fabricators Ltd", area: "Ranipet SIPCOT Industrial Hub", industry: "Metal Fabrication", cat: "Silver", div: "WES" },
  { name: "Sigma CNC Turning Components", area: "Coimbatore SIDCO Kurichi", industry: "Precision Engineering", cat: "Silver", div: "LUB" },
  { name: "Omni Hydraulics & Pneumatics", area: "Ambattur Industrial Estate", industry: "Hydraulics & Seals", cat: "Gold", div: "WES" },
  { name: "Quantum Auto Gears & Shafts", area: "Oragadam Automobile Hub", industry: "Automotive Ancillary", cat: "Gold", div: "LUB" },
  { name: "Pinnacle Heavy Forgings India", area: "Tiruvallur Industrial Area", industry: "Heavy Forging", cat: "Platinum", div: "LUB" },
  { name: "Zenith Precision Moulds Pvt Ltd", area: "Guindy Industrial Estate", industry: "Tooling & Moulds", cat: "Silver", div: "LUB" },
  { name: "Ultra Power Transmission Drives", area: "Hosur SIPCOT Phase-II", industry: "Power Transmission", cat: "Gold", div: "LUB" },
  { name: "Sterling Valves & Actuators", area: "Maraimalai Nagar Estate", industry: "Valves & Flow Control", cat: "Gold", div: "WES" },
  { name: "Trident Fasteners & Stampings", area: "Ambattur Industrial Estate", industry: "Fasteners & Hardware", cat: "Brass", div: "LUB" },
  { name: "Paramount Automotive Springs", area: "Sriperumbudur Auto Corridor", industry: "Automotive Ancillary", cat: "Silver", div: "LUB" },
  { name: "Alpha Steel Rolling Mills", area: "Ranipet SIPCOT Industrial Hub", industry: "Metal Fabrication", cat: "Gold", div: "WES" },
  { name: "Radiant Thermal Power Equipments", area: "Ennore Industrial Corridor", industry: "Heavy Machinery", cat: "Gold", div: "WES" },
  { name: "Pioneer Industrial Radiators", area: "Coimbatore SIDCO Kurichi", industry: "Heat Exchangers", cat: "Silver", div: "LUB" },
  { name: "Synergy Automotive Components", area: "Oragadam Automobile Hub", industry: "Automotive Ancillary", cat: "Gold", div: "LUB" },
  { name: "Vanguard Heavy Trailers India", area: "Tiruvallur Industrial Area", industry: "Heavy Vehicles", cat: "Gold", div: "LUB" },
  { name: "Excel CNC Machining Centre", area: "Ambattur Industrial Estate", industry: "Precision Engineering", cat: "Silver", div: "LUB" },
  { name: "Optima Plastic Moulding Solutions", area: "Guindy Industrial Estate", industry: "Polymers & Moulds", cat: "Brass", div: "WES" },
  { name: "Techno Metal Castings Limited", area: "Kolathur Industrial Area", industry: "Foundry & Castings", cat: "Gold", div: "LUB" },
  { name: "Macro Hydrotech Equipments", area: "Sriperumbudur Industrial Corridor", industry: "Hydraulics & Seals", cat: "Gold", div: "WES" },
  { name: "Micro Tooling & Spark Erosion", area: "Coimbatore Industrial Area", industry: "Tooling & Moulds", cat: "Brass", div: "LUB" },
  { name: "Aero Precision Aerospace Parts", area: "Hosur SIPCOT Phase-I", industry: "Aerospace Machining", cat: "Platinum", div: "LUB" },
  { name: "Delta Sheet Metal Fabrications", area: "Ranipet SIPCOT Industrial Hub", industry: "Metal Fabrication", cat: "Silver", div: "WES" },
  { name: "Atlas Conveyor Systems Works", area: "Ambattur Industrial Estate", industry: "Material Handling", cat: "Silver", div: "WES" },
  { name: "Prime Industrial Pumps & Motors", area: "Coimbatore SIDCO Kurichi", industry: "Pumps & Motors", cat: "Gold", div: "WES" },
  { name: "Kovai Heavy Engineering Works", area: "Singanallur Industrial Estate", industry: "Heavy Machinery", cat: "Gold", div: "LUB" },
  { name: "Chennai Precision Turning Works", area: "Guindy Industrial Estate", industry: "Precision Engineering", cat: "Silver", div: "LUB" },
  { name: "Madras Auto Gears Manufacturing", area: "Padi Industrial Estate", industry: "Automotive Transmission", cat: "Gold", div: "LUB" },
  { name: "Sri Balaji Industrial Fabricators", area: "Tiruvallur Industrial Area", industry: "Metal Fabrication", cat: "Brass", div: "WES" },
  { name: "Velan Precision Engineering", area: "Maraimalai Nagar Estate", industry: "Precision Engineering", cat: "Silver", div: "LUB" },
  { name: "Murugan Tooling & Extrusions", area: "Ambattur Industrial Estate", industry: "Tooling & Moulds", cat: "Silver", div: "LUB" },
  { name: "Kaveri Heavy Machinery Spares", area: "Ranipet SIPCOT Industrial Hub", industry: "Heavy Machinery", cat: "Gold", div: "WES" },
  { name: "Thangam Auto Electrical Units", area: "Oragadam Automobile Hub", industry: "Automotive Electricals", cat: "Silver", div: "LUB" },
  { name: "Kongu Industrial Hydraulic Valves", area: "Coimbatore SIDCO Kurichi", industry: "Hydraulics & Seals", cat: "Gold", div: "WES" },
  { name: "Chola Precision Metal Pressings", area: "Sriperumbudur Auto Corridor", industry: "Automotive Ancillary", cat: "Gold", div: "LUB" },
  { name: "Pandian Industrial Bearings Corp", area: "Madurai SIDCO Industrial Estate", industry: "Industrial Engineering", cat: "Silver", div: "LUB" },
  { name: "Cheran Precision Gear Cutters", area: "Hosur SIPCOT Phase-II", industry: "Precision Engineering", cat: "Platinum", div: "LUB" },
];

const CONTACT_NAMES = [
  { name: "K. Venkataraman", title: "Plant Head / VP Operations" },
  { name: "M. Selvakumar", title: "General Manager - Procurement" },
  { name: "R. Anandhakrishnan", title: "Senior Purchase Manager" },
  { name: "S. Vijayaraghavan", title: "Head of Materials & Supply Chain" },
  { name: "P. Muruganandam", title: "Maintenance & Reliability Lead" },
  { name: "A. Rajesh Kumar", title: "Sourcing Specialist - Lubricants" },
  { name: "G. Soundararajan", title: "Technical Purchase Manager" },
  { name: "N. Balamurugan", title: "Works Director" },
  { name: "T. Karthikeyan", title: "Chief Mechanical Engineer" },
  { name: "V. Chandrasekaran", title: "Production & Tooling Head" },
  { name: "D. Senthil Nathan", title: "Plant Maintenance Manager" },
  { name: "E. Ravichandran", title: "Stores & Commercial Incharge" },
];

async function main() {
  console.log("\n=======================================================");
  console.log("  SYNTHETIC TEST DATA GENERATOR — REALISTIC B2B CRM");
  console.log("=======================================================\n");

  // 1. Verify Products and Base Entities exist
  const products = await prisma.product.findMany({
    where: { tenantId: TENANT_ID, deletedAt: null },
    include: { principal: true },
  });
  if (products.length === 0) {
    throw new Error("No products found! Please ensure products catalog is preserved.");
  }
  console.log(`✓ Preserved ${products.length} Products across ${new Set(products.map((p) => p.principalId)).size} Principals.`);

  const salesUsers = await prisma.user.findMany({
    where: { tenantId: TENANT_ID, roleId: "role_sales" },
  });
  if (salesUsers.length === 0) {
    throw new Error("No sales users found! Please ensure sales users are preserved.");
  }
  console.log(`✓ Preserved ${salesUsers.length} Sales Users.`);

  const industries = await prisma.industry.findMany();
  console.log(`✓ Preserved ${industries.length} Industries.`);

  // 2. WIPE all operational non-product tables cleanly
  console.log("\n--- Cleaning up existing operational records (preserving products/users/roles) ---");
  await prisma.followUp.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.paymentFollowup.deleteMany({});
  await prisma.payment.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.orderStatusHistory.deleteMany({});
  await prisma.salesOrderItem.deleteMany({});
  await prisma.salesOrder.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.leadProduct.deleteMany({});
  await prisma.lead.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.projection.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.salesTarget.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.mapping.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.contact.deleteMany({});
  await prisma.customer.deleteMany({ where: { tenantId: TENANT_ID } });
  console.log("✓ Successfully wiped old non-product operational data.");

  // 3. Generate 60 Realistic Industrial Customers
  console.log("\n--- Generating 60 Realistic B2B Industrial Customers & Contacts ---");
  const paymentTermsList: PaymentTerms[] = ["Credit30", "Credit45", "Credit15", "Immediate", "Advance50Balance"];
  const payZones: PayZone[] = ["GreenZone", "GreenZone", "YellowZone", "RedZone"];

  const createdCustomers = [];
  for (let i = 0; i < REALISTIC_COMPANIES.length; i++) {
    const comp = REALISTIC_COMPANIES[i];
    const sp = salesUsers[i % salesUsers.length];
    const contact = CONTACT_NAMES[i % CONTACT_NAMES.length];
    const paymentTerms = paymentTermsList[i % paymentTermsList.length];
    const payZone = payZones[i % payZones.length];
    const industry = industries.find((ind) => ind.name.toLowerCase().includes("auto")) || industries[0];
    const outstanding = comp.cat === "Platinum" ? 350000 : comp.cat === "Gold" ? 180000 : comp.cat === "Silver" ? 75000 : 25000;

    const cust = await prisma.customer.create({
      data: {
        id: `syn_cust_${(i + 1).toString().padStart(3, "0")}`,
        tenantId: TENANT_ID,
        name: comp.name,
        division: comp.div as Division,
        category: comp.cat as CustomerCategory,
        type: "Existing",
        area: comp.area,
        industryId: industry?.id || null,
        subIndustry: comp.industry,
        paymentTerms,
        payZone,
        outstanding: String(outstanding),
        active: true,
        salespersonId: sp.id,
        collectorId: sp.id,
        contacts: {
          create: [
            {
              name: contact.name,
              designation: contact.title,
              mobile: `+91 9840${(100000 + i).toString()}`,
              phone: `044-26${(10000 + i).toString()}`,
              email: `purchase@${comp.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15)}.in`,
              isPrimary: true,
            },
          ],
        },
      },
    });
    createdCustomers.push(cust);
  }
  console.log(`✓ Created ${createdCustomers.length} Industrial Customers with primary key contacts.`);

  // 4. Generate 240 Customer-Product Mappings
  console.log("\n--- Generating 240 Customer-Product Mappings ---");
  const createdMappings = [];
  let mapIdx = 1;
  for (const cust of createdCustomers) {
    // Each customer gets 4 distinct mapped products
    for (let k = 0; k < 4; k++) {
      const product = products[(mapIdx * 7) % products.length];
      const basePrice = product.basePrice ? Number(product.basePrice) : 480;
      const customPrice = Math.round(basePrice * (0.92 + pseudoRandom(`price-${cust.id}-${product.id}`) * 0.16));

      const mapping = await prisma.mapping.create({
        data: {
          id: `syn_map_${mapIdx.toString().padStart(4, "0")}`,
          tenantId: TENANT_ID,
          customerId: cust.id,
          productId: product.id,
          salespersonId: cust.salespersonId,
          customPrice: String(customPrice),
        },
        include: { product: true, customer: true },
      });
      createdMappings.push(mapping);
      mapIdx++;
    }
  }
  console.log(`✓ Created ${createdMappings.length} Customer-Product Mappings with contractual agreed list prices.`);

  // 5. Generate Multi-Month Projections across ALL 12 Periods (2026-04 to 2027-03)
  console.log("\n--- Generating Projections across ALL 12 Periods for FY 2026-2027 ---");
  let totalProjections = 0;
  for (const period of ALL_PERIODS) {
    const isPast = period < "2026-09";
    const isCurrent = period === "2026-09";

    const projectionData = createdMappings.map((m) => {
      const rand = pseudoRandom(`${m.id}-${period}`);
      const baseQty = Math.floor(rand * 6 + 2) * 25; // 50 to 200 units
      const price = m.customPrice ? Number(m.customPrice) : 480;

      let achievedQty = 0;
      let status: ProjStatus = "ProjectionCreated";

      if (isPast) {
        const achRate = 0.75 + pseudoRandom(`ach-${m.id}-${period}`) * 0.25; // 75% - 100%
        achievedQty = Math.round(baseQty * achRate);
        status = achRate >= 0.9 ? "Completed" : "Confirmed";
      } else if (isCurrent) {
        const achRate = 0.3 + pseudoRandom(`ach-${m.id}-${period}`) * 0.45; // 30% - 75%
        achievedQty = Math.round(baseQty * achRate);
        status = achRate > 0.5 ? "PartiallyConfirmed" : "POReceived";
      } else {
        achievedQty = 0;
        status = rand > 0.55 ? "POExpected" : "ProjectionCreated";
      }

      return {
        id: `syn_proj_${m.id}_${period}`,
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
  }
  console.log(`✓ Created ${totalProjections} Recurring Projections across 12 periods.`);

  // 6. Generate Sales Targets across ALL 12 Periods
  console.log("\n--- Generating Sales Targets across ALL 12 Periods ---");
  let targetCount = 0;
  for (const user of salesUsers) {
    for (const period of ALL_PERIODS) {
      const targetVal = 1800000 + Math.floor(pseudoRandom(`tgt-${user.id}-${period}`) * 8) * 100000; // 18L - 25L
      await prisma.salesTarget.create({
        data: {
          tenantId: TENANT_ID,
          salespersonId: user.id,
          period,
          targetValue: String(targetVal),
        },
      });
      targetCount++;
    }
  }
  console.log(`✓ Created ${targetCount} Sales Targets (${salesUsers.length} reps × 12 periods).`);

  // 7. Generate Multi-Month Leads across all 9 Deal Stages
  console.log("\n--- Generating 45 Multi-Month New Sales Leads across all 9 Deal Stages ---");
  const dealStages: DealStage[] = [
    "NewEnquiries",
    "NeedsAnalysis",
    "TrialsAndSampleTests",
    "ProposalsAndPriceQuote",
    "NegotiationOralConfirmation",
    "ClosedWon",
    "ClosedLost",
    "NoRequirementOrCold",
    "TrialProblem",
  ];

  let leadCount = 0;
  for (let i = 0; i < 45; i++) {
    const period = ALL_PERIODS[i % ALL_PERIODS.length];
    const sp = salesUsers[i % salesUsers.length];
    const stage = dealStages[i % dealStages.length];
    const comp = REALISTIC_COMPANIES[i % REALISTIC_COMPANIES.length];
    const product = products[i % products.length];
    const leadDate = new Date(`${period}-08T10:30:00Z`);

    await prisma.lead.create({
      data: {
        id: `syn_lead_${(i + 1).toString().padStart(3, "0")}`,
        tenantId: TENANT_ID,
        customerName: `${comp.name.split(" ")[0]} Advanced Dynamics Unit ${i + 1}`,
        division: comp.div as Division,
        tier: comp.cat as CustomerCategory,
        type: "New",
        salespersonId: sp.id,
        stage,
        area: comp.area,
        contactName: `Mr. Shankar Narayanan`,
        phone: `+91 9789${(200000 + i).toString()}`,
        email: `sourcing@advancedynamics-${i + 1}.in`,
        createdAt: leadDate,
        expClose: new Date(`${period}-26T18:00:00Z`),
        nextFollowUp: new Date(`${period}-16T11:00:00Z`),
        products: {
          create: [
            {
              productName: product.name,
              brand: product.principal.name,
              qty: "100",
              price: product.basePrice ? String(product.basePrice) : "520",
              value: "52000",
            },
          ],
        },
        activities: {
          create: [
            {
              note: `Plant trial conducted. Technical evaluation stage: ${stage}.`,
              date: leadDate,
            },
          ],
        },
      },
    });
    leadCount++;
  }
  console.log(`✓ Created ${leadCount} New Sales Leads across all 9 deal stages.`);

  // 8. Generate 60 Multi-Month Sales Orders
  console.log("\n--- Generating 60 Multi-Month Sales Orders ---");
  const orderStatuses: OrderStatus[] = [
    "Created",
    "Acknowledged",
    "DeliveryPartnerAssigned",
    "DeliveredFromWarehouse",
    "DeliveredToCustomer",
    "CustomerReceiptConfirmed",
  ];
  const deliveryModes: DeliveryMode[] = ["TransportLR", "Courier", "CompanyVehicle", "CustomerPickup"];

  let orderCount = 0;
  for (let i = 0; i < 60; i++) {
    const period = ALL_PERIODS[i % ALL_PERIODS.length];
    const isPast = period < "2026-09";
    const status = isPast ? "CustomerReceiptConfirmed" : orderStatuses[i % orderStatuses.length];
    const cust = createdCustomers[i % createdCustomers.length];
    const sp = salesUsers.find((u) => u.id === cust.salespersonId) || salesUsers[0];
    const product = products[(i * 5) % products.length];
    const day = ((i * 3) % 24) + 1;
    const orderDate = new Date(`${period}-${day.toString().padStart(2, "0")}T09:30:00Z`);
    const code = `SO-${period.replace("-", "")}-${(101 + i).toString()}`;
    const qty = 60 + (i % 6) * 25;
    const price = product.basePrice ? Number(product.basePrice) : 520;
    const total = qty * price;

    await prisma.salesOrder.create({
      data: {
        id: `syn_so_${(i + 1).toString().padStart(3, "0")}`,
        tenantId: TENANT_ID,
        code,
        customerId: cust.id,
        salespersonId: sp.id,
        createdById: sp.id,
        date: orderDate,
        status,
        total: String(total),
        paymentTerms: cust.paymentTerms || "Credit30",
        deliveryMode: deliveryModes[i % deliveryModes.length],
        deliveryAddress: `${cust.area}, Chennai, Tamil Nadu`,
        transporterName: i % 2 === 0 ? "VRL Logistics Ltd" : "ARC Transporters",
        lrNumber: `LR-CHE-${(849000 + i).toString()}`,
        items: {
          create: [
            {
              productId: product.id,
              qty: String(qty),
              price: String(price),
              unit: product.unit || "Ltr",
            },
          ],
        },
        statusHistory: {
          create: [
            {
              status: "Created",
              note: `Monthly bulk dispatch order placed for ${cust.name}`,
              changedById: sp.id,
              at: orderDate,
            },
          ],
        },
      },
    });
    orderCount++;
  }
  console.log(`✓ Created ${orderCount} Multi-Month Sales Orders.`);

  // 9. Generate 75 Multi-Month Payments & Receivables
  console.log("\n--- Generating 75 Multi-Month Payments & Receivables ---");
  /**
   * The first `n` reminder letters, sent on the collections desk's schedule:
   * 30 days after the invoice, then every fortnight. Returned as the flag and
   * date pair the Payment model holds, so a seeded chase is always a prefix —
   * never a third letter with no first.
   */
  const remindersSent = (n: number, invoiceDate: Date) =>
    Object.fromEntries(
      [0, 1, 2, 3].flatMap((i) => [
        [`mail${i + 1}`, i < n],
        [
          `mail${i + 1}At`,
          i < n ? new Date(invoiceDate.getTime() + (30 + i * 15) * 86_400_000) : null,
        ],
      ]),
    );

  const payStatuses: PaymentStatus[] = ["Paid", "PartiallyPaid", "Pending", "Overdue"];
  let paymentCount = 0;
  for (let i = 0; i < 75; i++) {
    const period = ALL_PERIODS[i % ALL_PERIODS.length];
    const cust = createdCustomers[i % createdCustomers.length];
    const sp = salesUsers.find((u) => u.id === cust.salespersonId) || salesUsers[0];
    const invoiceNo = `INV-${period.replace("-", "")}-${(201 + i).toString()}`;
    const isPast = period < "2026-09";
    const status: PaymentStatus = isPast ? "Paid" : payStatuses[i % payStatuses.length];
    const payZone: PayZone = cust.payZone || payZones[i % payZones.length];
    const amount = 75000 + (i % 10) * 20000;
    const received = status === "Paid" ? amount : status === "PartiallyPaid" ? Math.round(amount * 0.5) : 0;
    const pending = amount - received;
    const agingDays = isPast ? 0 : (i % 110) + 10;

    await prisma.payment.create({
      data: {
        id: `syn_pay_${(i + 1).toString().padStart(3, "0")}`,
        tenantId: TENANT_ID,
        refNo: `PAY-REF-${(1001 + i).toString()}`,
        customerId: cust.id,
        customerName: cust.name,
        salespersonId: sp.id,
        invoiceNo,
        invoiceDate: new Date(`${period}-04T10:00:00Z`),
        dueDate: new Date(`${period}-24T10:00:00Z`),
        amount: String(amount),
        received: String(received),
        pending: String(pending),
        agingDays,
        payZone,
        status,
        // The chase is a sequence, so the letters sent are a prefix of it:
        // `mail1: i % 2, mail2: i % 3` produced invoices whose second letter
        // had gone but not their first, which is a state no collections desk
        // can reach and which the UI now (correctly) refuses to create.
        ...remindersSent(i % 4, new Date(`${period}-04T10:00:00Z`)),
        followups: {
          create: [
            {
              note: `Cheque collection reminder sent to accounts desk for ${invoiceNo}`,
              date: new Date(`${period}-10T10:00:00Z`),
              nextFollowupDate: new Date(`${period}-20T10:00:00Z`),
            },
          ],
        },
      },
    });
    paymentCount++;
  }
  console.log(`✓ Created ${paymentCount} Multi-Month Payment records.`);

  // 10. Generate 60 Actionable Follow-ups Timeline
  console.log("\n--- Generating 60 Actionable Follow-ups Timeline ---");
  const allProjs = await prisma.projection.findMany({ where: { tenantId: TENANT_ID }, take: 60 });
  let followUpCount = 0;
  for (let i = 0; i < 60; i++) {
    const period = ALL_PERIODS[i % ALL_PERIODS.length];
    const sp = salesUsers[i % salesUsers.length];
    const isPast = period < "2026-09";
    const day = ((i * 4) % 24) + 1;
    const dueDate = new Date(`${period}-${day.toString().padStart(2, "0")}T11:00:00Z`);
    const entityType: EntityType = i % 3 === 0 ? "Projection" : i % 3 === 1 ? "Lead" : "Payment";
    const entityId = allProjs[i % allProjs.length]?.id || `ent-${i}`;

    await prisma.followUp.create({
      data: {
        id: `syn_fu_${(i + 1).toString().padStart(3, "0")}`,
        tenantId: TENANT_ID,
        entityType,
        entityId,
        salespersonId: sp.id,
        title: `Follow-up on ${entityType} #${i + 1}`,
        subtitle: `Monthly commercial review for period ${period}`,
        amount: String(55000 + (i % 8) * 15000),
        dueDate,
        done: isPast ? true : i % 2 === 0,
        note: `Review requirements and confirm scheduled delivery for ${period}`,
      },
    });
    followUpCount++;
  }
  console.log(`✓ Created ${followUpCount} Actionable Follow-ups.`);

  console.log("\n=======================================================");
  console.log("  SYNTHETIC DATA GENERATION COMPLETED SUCCESSFULLY!");
  console.log("=======================================================");
  console.log(`✓ Preserved Products: ${products.length}`);
  console.log(`✓ Created Customers: ${createdCustomers.length}`);
  console.log(`✓ Created Mappings: ${createdMappings.length}`);
  console.log(`✓ Created Projections (12 periods): ${totalProjections}`);
  console.log(`✓ Created Sales Targets (12 periods): ${targetCount}`);
  console.log(`✓ Created Leads (9 stages): ${leadCount}`);
  console.log(`✓ Created Sales Orders: ${orderCount}`);
  console.log(`✓ Created Payments: ${paymentCount}`);
  console.log(`✓ Created Follow-ups: ${followUpCount}`);
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("Synthetic data generation failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
