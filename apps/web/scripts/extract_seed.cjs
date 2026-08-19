const fs = require('fs');
const path = require('path');

const htmlPath = 'C:/Users/Kannan/Downloads/GreatSales_Tracker_POC_v6.html';
const html = fs.readFileSync(htmlPath, 'utf8');

const seedMatch = html.match(/const SEED = (\{[\s\S]*?\});\nconst PAY_SEED/);
const payMatch = html.match(/const PAY_SEED = (\[[\s\S]*?\]);\n/);

if (!seedMatch || !payMatch) {
  console.error('Could not match seed or pay');
  process.exit(1);
}

const seed = JSON.parse(seedMatch[1]);
const paySeed = JSON.parse(payMatch[1]);

const spToUserId = {
  'Megala': 'u_megala',
  'Surendiran': 'u_surendiran',
  'Balakrishnan': 'u_balakrishnan',
  'Rajiev': 'u_rajiev',
  'Ramkumar': 'u_ramkumar',
  'Promech': 'u_promech',
  'Administrator': 'u_admin',
  'Management': 'u_mgmt'
};

const users = [
  { id: 'u_admin', name: 'Administrator', username: 'admin', email: 'admin@greatsales.in', role: 'admin', active: true, lastLogin: '2026-08-17' },
  { id: 'u_mgmt', name: 'Management', username: 'manager', email: 'mgmt@greatsales.in', role: 'mgmt', active: true, lastLogin: '2026-08-16' },
  { id: 'u_megala', name: 'Megala', username: 'megala', email: 'megala@greatsales.in', role: 'sales', active: true, lastLogin: '2026-08-17' },
  { id: 'u_surendiran', name: 'Surendiran', username: 'surendiran', email: 'surendiran@greatsales.in', role: 'sales', active: true, lastLogin: '2026-08-17' },
  { id: 'u_balakrishnan', name: 'Balakrishnan', username: 'balakrishnan', email: 'balakrishnan@greatsales.in', role: 'sales', active: true, lastLogin: '2026-08-15' },
  { id: 'u_rajiev', name: 'Rajiev', username: 'rajiev', email: 'rajiev@greatsales.in', role: 'sales', active: true, lastLogin: '2026-08-16' },
  { id: 'u_ramkumar', name: 'Ramkumar', username: 'ramkumar', email: 'ramkumar@greatsales.in', role: 'sales', active: true, lastLogin: '2026-08-17' },
  { id: 'u_promech', name: 'Promech', username: 'promech', email: 'promech@greatsales.in', role: 'sales', active: true, lastLogin: '2026-08-14' }
];

const distinctBrands = [...new Set(seed.products.map(p => p.brand))];
if (!distinctBrands.includes('CASTROL')) distinctBrands.push('CASTROL');
distinctBrands.sort();

const principals = distinctBrands.map(b => ({
  id: 'pr_' + b.toLowerCase().replace(/[^a-z0-9]/g, '_'),
  name: b
}));

const brandToPrId = {};
principals.forEach(p => { brandToPrId[p.name] = p.id; });

const products = seed.products.map(p => ({
  id: p.id,
  name: p.name,
  sku: p.id,
  principalId: brandToPrId[p.brand] || 'pr_' + p.brand.toLowerCase(),
  principalName: p.brand,
  division: p.div || 'LUB',
  unit: 'Ltr',
  listPrice: p.price != null ? p.price : 0,
  active: true
}));

const prodMap = {};
products.forEach(p => { prodMap[p.id] = p; });

const areas = ['Ambattur', 'Guindy', 'Sriperumbudur', 'Oragadam', 'Maraimalai Nagar', 'Irungattukottai', 'Thirumudivakkam', 'Gummidipoondi', 'Red Hills'];

const customers = seed.customers.map((c, i) => {
  const repId = spToUserId[c.sp] || 'u_megala';
  const payId = spToUserId[c.pay] || repId;
  const tier = c.cat || 'Silver';
  const area = areas[i % areas.length];
  return {
    id: c.id,
    name: c.name,
    division: c.div || 'LUB',
    tier: tier,
    type: c.type || 'Existing',
    area: area,
    industry: c.div === 'WES' ? 'Surface Treatment & Coating' : 'Automotive & Auto Components',
    subIndustry: c.div === 'WES' ? 'Powder Coating & Electrostatic' : 'Precision Machining',
    contactName: c.contactName || '',
    mobile: c.mobile || '',
    phone: c.mobile || '',
    whatsapp: c.whatsapp || c.mobile || '',
    sameAsMobile: c.sameAsMobile !== false,
    email: '',
    ownerId: repId,
    collectorId: payId,
    paymentTerms: c.paymentTerms || '30 Days Credit',
    payZone: (tier === 'Platinum' ? 'Green Zone' : tier === 'Gold' ? 'Yellow Zone' : tier === 'Brass' ? 'Red Zone' : 'Green Zone'),
    outstanding: 0,
    active: true
  };
});

const custMap = {};
customers.forEach(c => { custMap[c.id] = c; });

const mappings = seed.maps; // {id, c, p, sp, price}

const juneProjMap = {};
seed.juneProj.forEach(jp => {
  juneProjMap[jp.m] = jp;
});

const projections = [];
// Generate projections for 2026-06 and 2026-08 (current month)
mappings.forEach(m => {
  const cust = custMap[m.c];
  const prod = prodMap[m.p];
  if (!cust || !prod) return;
  const ownerId = spToUserId[m.sp] || cust.ownerId;
  const price = m.price != null ? m.price : (prod.listPrice || 0);

  // 2026-06 projection
  const jp = juneProjMap[m.id];
  if (jp) {
    projections.push({
      id: 'pj_' + m.id + '_2026-06',
      mapId: m.id,
      month: '2026-06',
      customerId: m.c,
      productId: m.p,
      ownerId: ownerId,
      projectedQty: jp.q,
      achievedQty: jp.q ? Math.round(jp.q * 0.85) : 0,
      price: jp.price || price,
      customPrice: jp.price || price,
      status: 'Confirmed',
      nextFollowUp: null,
      targetDate: '2026-06-25',
      salesOrderId: null,
      remarks: []
    });
  }

  // 2026-08 (current active month)
  const isTop = cust.tier === 'Platinum' || cust.tier === 'Gold' || jp != null;
  const baseQty = jp ? jp.q : (cust.tier === 'Platinum' ? 100 : cust.tier === 'Gold' ? 50 : 0);
  if (baseQty > 0 || isTop) {
    const projQty = baseQty || 20;
    const achQty = projQty > 50 ? Math.round(projQty * 0.6) : 0;
    const status = achQty > 0 ? (achQty >= projQty ? 'Confirmed' : 'Partially Confirmed') : (jp ? 'Customer Interested' : 'Projection Created');
    projections.push({
      id: 'pj_' + m.id + '_2026-08',
      mapId: m.id,
      month: '2026-08',
      customerId: m.c,
      productId: m.p,
      ownerId: ownerId,
      projectedQty: projQty,
      achievedQty: achQty,
      price: price,
      customPrice: price,
      status: status,
      nextFollowUp: (status === 'Customer Interested' || status === 'Projection Created') ? '2026-08-20' : null,
      targetDate: '2026-08-28',
      salesOrderId: status === 'Confirmed' ? 'SO0001' : null,
      remarks: [{ date: '2026-08-10', user: m.sp, text: 'Requirement discussed with purchase team.' }]
    });
  }
});

const payments = paySeed.map((r, i) => {
  const id = 'pay_' + String(i + 1).padStart(4, '0');
  const repId = spToUserId[r.sp] || 'u_megala';
  return {
    id: id,
    refNo: r.ref || ('INV-' + (1000 + i)),
    customerId: null,
    customerName: r.party,
    ownerId: repId,
    invoiceNo: r.ref || ('INV-' + (1000 + i)),
    invoiceDate: r.date,
    amount: r.opening,
    pending: r.pending,
    received: r.received || 0,
    dueDate: r.date,
    zone: r.zone || 'Red Zone',
    delayReason: r.reason || '',
    nextFollowUp: r.zone === 'Red Zone' ? '2026-08-19' : null,
    mail1: r.mail1 === 'Yes',
    mail2: r.mail2 === 'Yes',
    mail3: r.mail3 === 'Yes',
    mail4: r.mail4 === 'Yes',
    remarks: r.reason ? [{ date: '2026-08-12', user: r.sp || 'Accounts', text: r.reason }] : []
  };
});

const leads = [
  {
    id: 'L0001',
    name: 'Sri Mahalakshmi Auto Forgings',
    contactName: 'Mr. Ganesan',
    phone: '+91 97901 11222',
    whatsapp: '+91 97901 11222',
    sameAsMobile: true,
    email: 'ganesan@smaforgings.com',
    ownerId: 'u_megala',
    stage: 'Negotiation / Oral Confirmation',
    industry: 'Foundry, Forging & Metallurgy',
    subIndustry: 'Steel Forging & Extrusion',
    area: 'Sriperumbudur',
    tier: 'Platinum',
    products: [
      { id: 'lp_1', principalId: 'pr_castrol', name: 'Syntilo 9954 Premium', qty: 400, unit: 'Ltr', price: 520, value: 208000 },
      { id: 'lp_2', principalId: 'pr_castrol', name: 'Tribol GR Grease', qty: 60, unit: 'Kg', price: 850, value: 51000 },
    ],
    address: 'Plot 14, SIDCO Industrial Estate, Sriperumbudur, Kanchipuram 602105',
    nextFollowUp: '2026-08-18',
    expClose: '2026-08-25',
    remarks: [{ date: '2026-08-14', user: 'Megala', text: 'Director agreed verbally on rates; formal PO promised by Wednesday.' }],
    createdAt: '2026-07-20',
    stageUpdatedAt: '2026-08-14',
  },
  {
    id: 'L0002',
    name: 'Apex Precision Tooling',
    contactName: 'Mr. Venkatesh',
    phone: '+91 97902 22333',
    whatsapp: '+91 97902 22333',
    sameAsMobile: true,
    email: 'venkat@apextooling.in',
    ownerId: 'u_surendiran',
    stage: 'Trials & Sample Tests',
    industry: 'General Engineering & Machining',
    subIndustry: 'Tool Room & Die Making',
    area: 'Guindy',
    tier: 'Gold',
    products: [
      { id: 'lp_3', principalId: 'pr_castrol', name: 'Hysol X Coolant', qty: 200, unit: 'Ltr', price: 380, value: 76000 },
    ],
    address: '23 Ekkaduthangal Main Road, Guindy Industrial Estate, Chennai 600032',
    nextFollowUp: '2026-08-20',
    expClose: '2026-09-05',
    remarks: [{ date: '2026-08-09', user: 'Surendiran', text: 'Sample barrel charged in CNC machine 4. Tool wear test in progress.' }],
    createdAt: '2026-08-01',
    stageUpdatedAt: '2026-08-09',
  },
  {
    id: 'L0003',
    name: 'Delta Coating Technologies',
    contactName: 'Ms. Sharmila',
    phone: '+91 97903 33444',
    whatsapp: '+91 97903 33444',
    sameAsMobile: true,
    email: 'sharmila@deltacoat.com',
    ownerId: 'u_ramkumar',
    stage: 'Proposals & Price Quote',
    industry: 'Surface Treatment & Coating',
    subIndustry: 'Electroplating (Zinc / Chrome / Nickel)',
    area: 'Ambattur',
    tier: 'Silver',
    products: [
      { id: 'lp_4', principalId: 'pr_wes', name: 'Anti-Spatter & Pickling Pack', qty: 50, unit: 'Pkt', price: 1200, value: 60000 },
    ],
    address: '5B Ambattur Industrial Estate, Redhills Road, Chennai 600098',
    nextFollowUp: '2026-08-19',
    expClose: '2026-09-12',
    remarks: [{ date: '2026-08-13', user: 'Ramkumar', text: 'Quote submitted with 30-day payment credit terms.' }],
    createdAt: '2026-08-04',
    stageUpdatedAt: '2026-08-13',
  },
  {
    id: 'L0004',
    name: 'Pioneer Automotive Line',
    contactName: 'Mr. Srinivasan',
    phone: '+91 97904 44555',
    whatsapp: '+91 97904 44555',
    sameAsMobile: true,
    email: 'srini@pioneerauto.in',
    ownerId: 'u_rajiev',
    stage: 'Closed Won',
    industry: 'Automotive & Auto Components',
    subIndustry: 'Brake Systems & Suspension',
    area: 'Oragadam',
    tier: 'Platinum',
    products: [
      { id: 'lp_5', principalId: 'pr_castrol', name: 'Complete Lubrication Contract', qty: 1, unit: 'Set', price: 320000, value: 320000 },
    ],
    address: 'Unit 7, Oragadam SEZ, Sriperumbudur Taluk, Kanchipuram 602105',
    nextFollowUp: null,
    expClose: '2026-08-11',
    remarks: [{ date: '2026-08-11', user: 'Rajiev', text: 'Annual supply contract signed and first PO received!' }],
    createdAt: '2026-06-15',
    stageUpdatedAt: '2026-08-11',
  }
];

const orders = [
  {
    id: 'SO0001',
    code: 'SO/26-27/0001',
    customerId: 'C001',
    customerName: '4 Edge Automation',
    ownerId: 'u_megala',
    status: 'Delivered to Customer',
    lines: [
      { productId: 'P034', productName: 'ANLITH MOLY', principalName: 'CASTROL', qty: 100, price: 380, unit: 'Ltr' }
    ],
    isUrgent: true,
    paymentTerm: '30 Days Credit',
    deliveryMode: 'Transport (LR)',
    deliveryAddress: '4 Edge Automation, Plot 22 Ambattur Industrial Estate, Chennai 600058',
    expectedDelivery: '2026-08-18T16:00',
    transporterName: 'VRL Logistics',
    deliveryInstructions: 'Deliver directly to Gate 2 Store',
    history: [
      { status: 'Created', timestamp: '2026-08-11T10:30', note: 'Order created from monthly projection', by: 'Megala' },
      { status: 'Acknowledged', timestamp: '2026-08-11T14:15', note: 'Inventory allocated at Central Hub', by: 'Administrator' },
      { status: 'Delivery Partner Assigned', timestamp: '2026-08-12T09:00', note: 'Handed over to VRL LR #98223', by: 'Administrator' },
      { status: 'Delivered from Warehouse', timestamp: '2026-08-12T17:30', note: 'Dispatched in truck TN-04-AB-1234', by: 'Warehouse' },
      { status: 'Delivered to Customer', timestamp: '2026-08-13T11:45', note: 'Reached factory gate, waiting for store signoff', by: 'VRL Logistics' }
    ],
    createdAt: '2026-08-11T10:30:00Z',
    createdBy: 'Megala'
  },
  {
    id: 'SO0002',
    code: 'SO/26-27/0002',
    customerId: 'C058',
    customerName: 'CROWNTECH SURFACE FINISHINGS PRIVATE LIMITED-Irungattukottai,',
    ownerId: 'u_ramkumar',
    status: 'Acknowledged',
    lines: [
      { productId: 'P012', productName: 'Welding Wire', principalName: 'WES', qty: 500, price: 160, unit: 'Kg' }
    ],
    isUrgent: false,
    paymentTerm: '30 Days Credit',
    deliveryMode: 'Company Vehicle',
    deliveryAddress: 'CROWNTECH SURFACE FINISHINGS, Irungattukottai SIPCOT, Sriperumbudur 602117',
    expectedDelivery: '2026-08-20T14:00',
    transporterName: 'Local Express',
    history: [
      { status: 'Created', timestamp: '2026-08-14T11:00', note: 'Order placed against PO #CT/26/089', by: 'Ramkumar' },
      { status: 'Acknowledged', timestamp: '2026-08-14T15:30', note: 'Stock verified and ready for packaging', by: 'Administrator' }
    ],
    createdAt: '2026-08-14T11:00:00Z',
    createdBy: 'Ramkumar'
  }
];

const outTs = `import type { Customer, Lead, Payment, Principal, Product, Projection, SalesOrder, User } from './types';

export const POC_USERS: User[] = ` + JSON.stringify(users, null, 2) + `;

export const POC_PRINCIPALS: Principal[] = ` + JSON.stringify(principals, null, 2) + `;

export const POC_PRODUCTS: Product[] = ` + JSON.stringify(products, null, 2) + `;

export const POC_CUSTOMERS: Customer[] = ` + JSON.stringify(customers, null, 2) + `;

export const POC_MAPPINGS = ` + JSON.stringify(mappings, null, 2) + `;

export const POC_PROJECTIONS: Projection[] = ` + JSON.stringify(projections, null, 2) + `;

export const POC_PAYMENTS: Payment[] = ` + JSON.stringify(payments, null, 2) + `;

export const POC_LEADS: Lead[] = ` + JSON.stringify(leads, null, 2) + `;

export const POC_ORDERS: SalesOrder[] = ` + JSON.stringify(orders, null, 2) + `;
`;

fs.writeFileSync('apps/web/src/data/pocSeedData.ts', outTs, 'utf8');
console.log('Successfully written apps/web/src/data/pocSeedData.ts');
