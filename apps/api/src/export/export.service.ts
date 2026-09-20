import { Injectable } from '@nestjs/common';
import type {
  CustomerRow,
  LeadRow,
  OrderRow,
  PaymentRow,
  PrincipalRow,
  ProductRow,
  RequestUser,
} from '@greatsales/shared';
import { CustomersService } from '../customers/customers.service';
import { LeadsService } from '../leads/leads.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ProductsService } from '../products/products.service';
import { csvSection } from './csv';

/**
 * The server's page cap (`CursorPageQuerySchema`, packages/shared/src/pagination.ts)
 * is 100 — this walks pages of that size rather than one unbounded query, so
 * a large tenant is many small round trips instead of one query the database
 * has to hold open and materialise all at once.
 */
const PAGE_SIZE = 100;

/**
 * Full tenant data export for the Data & Governance page.
 *
 * Composes the same per-entity services the Customers/Leads/Orders/Payments/
 * Products pages already call, walking every cursor page rather than reading
 * whatever the frontend had cached — the export used to be built client-side
 * from exactly that cache, so it silently reported only the first page (20-100
 * rows) as if it were the whole tenant. Because it calls the real services
 * with the real `RequestUser`, a sales-role caller gets exactly their own
 * scoped book (the same `resolveOwnerScope` rule the pages enforce), never
 * the whole tenant's — this is not a bypass of that scoping, only a bulk read
 * of it.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly customers: CustomersService,
    private readonly leads: LeadsService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly products: ProductsService,
  ) {}

  async tenantCsv(
    user: RequestUser,
  ): Promise<{ filename: string; body: string }> {
    const [
      customerRows,
      leadRows,
      orderRows,
      paymentRows,
      productRows,
      principalRows,
    ] = await Promise.all([
      this.fetchAllPages<CustomerRow>((cursor) =>
        this.customers.list(user, { limit: PAGE_SIZE, cursor }),
      ),
      this.fetchAllPages<LeadRow>((cursor) =>
        this.leads.list(user, { limit: PAGE_SIZE, cursor }),
      ),
      this.fetchAllPages<OrderRow>((cursor) =>
        this.orders.list(user, { limit: PAGE_SIZE, cursor }),
      ),
      this.fetchAllPages<PaymentRow>((cursor) =>
        this.payments.list(user, { limit: PAGE_SIZE, cursor }),
      ),
      this.fetchAllPages<ProductRow>((cursor) =>
        this.products.list(user, { limit: PAGE_SIZE, cursor }),
      ),
      // Not paginated server-side — the whole catalog of brands is the answer
      // (see products.ts: PrincipalListResponse has no cursor/total).
      this.products.listPrincipals(user).then((r) => r.items),
    ]);

    const body = [
      csvSection<CustomerRow>('Customers', customerRows, [
        { header: 'ID', value: (r) => r.id },
        { header: 'Name', value: (r) => r.name },
        { header: 'Category', value: (r) => r.category },
        { header: 'Type', value: (r) => r.type },
        { header: 'Division', value: (r) => r.division },
        { header: 'Industry', value: (r) => r.industryName },
        { header: 'Sub-industry', value: (r) => r.subIndustry },
        { header: 'Area', value: (r) => r.area },
        { header: 'Payment terms', value: (r) => r.paymentTerms },
        { header: 'Pay zone', value: (r) => r.payZone },
        { header: 'Outstanding', value: (r) => r.outstanding },
        { header: 'Active', value: (r) => r.active },
        { header: 'Salesperson', value: (r) => r.salespersonName },
        { header: 'Collector', value: (r) => r.collectorName },
        { header: 'Primary contact', value: (r) => r.primaryContactName },
        { header: 'Primary phone', value: (r) => r.primaryContactPhone },
        { header: 'Created at', value: (r) => r.createdAt },
        { header: 'Updated at', value: (r) => r.updatedAt },
      ]),
      csvSection<PrincipalRow>('Principal Brands', principalRows, [
        { header: 'ID', value: (r) => r.id },
        { header: 'Name', value: (r) => r.name },
        { header: 'Product count', value: (r) => r.productCount },
        { header: 'Created at', value: (r) => r.createdAt },
        { header: 'Updated at', value: (r) => r.updatedAt },
      ]),
      csvSection<ProductRow>('Product Catalog', productRows, [
        { header: 'ID', value: (r) => r.id },
        { header: 'Name', value: (r) => r.name },
        { header: 'SKU', value: (r) => r.sku },
        { header: 'Principal', value: (r) => r.principalName },
        { header: 'Division', value: (r) => r.division },
        { header: 'Unit', value: (r) => r.unit },
        { header: 'Base price', value: (r) => r.basePrice },
        { header: 'Active', value: (r) => r.active },
        { header: 'Created at', value: (r) => r.createdAt },
        { header: 'Updated at', value: (r) => r.updatedAt },
      ]),
      csvSection<LeadRow>('Sales Leads', leadRows, [
        { header: 'ID', value: (r) => r.id },
        { header: 'Customer', value: (r) => r.customerName },
        { header: 'Stage', value: (r) => r.stage },
        { header: 'Tier', value: (r) => r.tier },
        { header: 'Type', value: (r) => r.type },
        { header: 'Division', value: (r) => r.division },
        { header: 'Industry', value: (r) => r.industryName },
        { header: 'Area', value: (r) => r.area },
        { header: 'Salesperson', value: (r) => r.salespersonName },
        { header: 'Contact', value: (r) => r.contactName },
        { header: 'Phone', value: (r) => r.phone },
        { header: 'Next follow-up', value: (r) => r.nextFollowUp },
        { header: 'Expected close', value: (r) => r.expClose },
        { header: 'Total value', value: (r) => r.totalValue },
        { header: 'Created at', value: (r) => r.createdAt },
        { header: 'Updated at', value: (r) => r.updatedAt },
      ]),
      csvSection<OrderRow>('Sales Orders', orderRows, [
        { header: 'ID', value: (r) => r.id },
        { header: 'Order no.', value: (r) => r.code },
        { header: 'Customer', value: (r) => r.customerName },
        { header: 'Salesperson', value: (r) => r.salespersonName },
        { header: 'Date', value: (r) => r.date },
        { header: 'Status', value: (r) => r.status },
        { header: 'Total', value: (r) => r.total },
        { header: 'Urgent', value: (r) => r.isUrgent },
        { header: 'Payment terms', value: (r) => r.paymentTerms },
        { header: 'Delivery mode', value: (r) => r.deliveryMode },
        { header: 'Expected delivery', value: (r) => r.expectedDelivery },
        { header: 'Transporter', value: (r) => r.transporterName },
        { header: 'LR number', value: (r) => r.lrNumber },
        { header: 'Item count', value: (r) => r.items.length },
        { header: 'Cancel reason', value: (r) => r.cancelReason },
        { header: 'Created at', value: (r) => r.createdAt },
        { header: 'Updated at', value: (r) => r.updatedAt },
      ]),
      csvSection<PaymentRow>('Invoices & Receivables', paymentRows, [
        { header: 'ID', value: (r) => r.id },
        { header: 'Ref no.', value: (r) => r.refNo },
        { header: 'Invoice no.', value: (r) => r.invoiceNo },
        { header: 'Customer', value: (r) => r.customerName },
        { header: 'Salesperson', value: (r) => r.salespersonName },
        { header: 'Invoice date', value: (r) => r.invoiceDate },
        { header: 'Amount', value: (r) => r.amount },
        { header: 'Received', value: (r) => r.received },
        { header: 'Pending', value: (r) => r.pending },
        { header: 'Due date', value: (r) => r.dueDate },
        // Two columns, because they are two numbers. Aging is the age of the
        // invoice; overdue is how far past the date this customer's credit
        // terms give it. One column used to carry the second under the first's
        // name, which is how a spreadsheet of receivables came out 30 days
        // short of what the invoice dates said.
        { header: 'Aging (days)', value: (r) => r.agingDays },
        { header: 'Overdue (days)', value: (r) => r.overdueDays },
        { header: 'Pay zone', value: (r) => r.payZone },
        { header: 'Status', value: (r) => r.status },
        { header: 'Delay reason', value: (r) => r.delayReason },
        { header: 'Next follow-up', value: (r) => r.nextFollowUp },
        { header: 'Created at', value: (r) => r.createdAt },
        { header: 'Updated at', value: (r) => r.updatedAt },
      ]),
    ].join('\r\n\r\n');

    const date = new Date().toISOString().slice(0, 10);
    return {
      filename: `GreatSales_${user.tenantId}_Export_${date}.csv`,
      body,
    };
  }

  /** Walks every cursor page of a `list()`-shaped query into one array. */
  private async fetchAllPages<T>(
    page: (
      cursor: string | undefined,
    ) => Promise<{ items: T[]; nextCursor: string | null }>,
  ): Promise<T[]> {
    const all: T[] = [];
    let cursor: string | undefined;
    for (;;) {
      const res = await page(cursor);
      all.push(...res.items);
      if (!res.nextCursor) return all;
      cursor = res.nextCursor;
    }
  }
}
