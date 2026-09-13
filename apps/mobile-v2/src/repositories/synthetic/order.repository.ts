import type { OrderRepository } from '../interfaces';
import type { SalesOrder, OrderStatusValue } from '../../domain/types';
import { canonicalState } from './canonical-state';

export class SyntheticOrderRepository implements OrderRepository {
  async list(params?: { search?: string; status?: string }): Promise<SalesOrder[]> {
    let result = [...canonicalState.orders];

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.code.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          (o.transporterName && o.transporterName.toLowerCase().includes(q)),
      );
    }

    if (params?.status && params.status !== 'ALL') {
      result = result.filter((o) => o.status === params.status);
    }

    return result;
  }

  async getById(id: string): Promise<SalesOrder | null> {
    const order = canonicalState.orders.find((o) => o.id === id);
    return order ? { ...order } : null;
  }

  async create(input: Omit<SalesOrder, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'statusHistory'>): Promise<SalesOrder> {
    const count = canonicalState.orders.length + 850;
    const code = `SO-2026-${count}`;
    const id = `so_${Date.now()}`;
    const now = new Date().toISOString();

    const newOrder: SalesOrder = {
      ...input,
      id,
      code,
      status: 'Created',
      statusHistory: [
        {
          id: `sh_${Date.now()}`,
          status: 'Created',
          note: 'Sales order booked via GreatSales Mobile',
          changedById: canonicalState.currentUser.id,
          changedByName: canonicalState.currentUser.name,
          at: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    canonicalState.orders.unshift(newOrder);

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Order',
      entityId: id,
      customerId: newOrder.customerId,
      customerName: newOrder.customerName,
      type: 'order',
      description: `Sales order ${code} created for ${newOrder.customerName} (₹${newOrder.total.toLocaleString('en-IN')})`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    // Cross-module notification
    canonicalState.notifications.unshift({
      id: `notif_${Date.now()}`,
      type: 'order_update',
      title: `Order Created — ${code}`,
      message: `${newOrder.customerName}: Order total ₹${newOrder.total.toLocaleString('en-IN')} created.`,
      entityType: 'Order',
      entityId: id,
      isRead: false,
      createdAt: now,
    });

    return { ...newOrder };
  }

  async advanceStatus(id: string, nextStatus: OrderStatusValue, note?: string): Promise<SalesOrder> {
    const index = canonicalState.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Order with ID ${id} not found.`);
    }

    const order = canonicalState.orders[index];
    const now = new Date().toISOString();

    const newHistory = [
      ...order.statusHistory,
      {
        id: `sh_${Date.now()}`,
        status: nextStatus,
        note: note || `Status advanced to ${nextStatus}`,
        changedById: canonicalState.currentUser.id,
        changedByName: canonicalState.currentUser.name,
        at: now,
      },
    ];

    const updated: SalesOrder = {
      ...order,
      status: nextStatus,
      statusHistory: newHistory,
      updatedAt: now,
    };
    canonicalState.orders[index] = updated;

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Order',
      entityId: id,
      customerId: order.customerId,
      customerName: order.customerName,
      type: 'order',
      description: `Order ${order.code} advanced to ${nextStatus}${note ? `: ${note}` : ''}`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...updated };
  }

  async cancelOrder(id: string, reason: string): Promise<SalesOrder> {
    const index = canonicalState.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Order with ID ${id} not found.`);
    }

    const order = canonicalState.orders[index];
    const now = new Date().toISOString();

    const newHistory = [
      ...order.statusHistory,
      {
        id: `sh_${Date.now()}`,
        status: 'Cancelled' as const,
        note: `Cancelled: ${reason}`,
        changedById: canonicalState.currentUser.id,
        changedByName: canonicalState.currentUser.name,
        at: now,
      },
    ];

    const updated: SalesOrder = {
      ...order,
      status: 'Cancelled',
      cancelReason: reason,
      cancelledAt: now,
      statusHistory: newHistory,
      updatedAt: now,
    };
    canonicalState.orders[index] = updated;

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Order',
      entityId: id,
      customerId: order.customerId,
      customerName: order.customerName,
      type: 'order',
      description: `Order ${order.code} cancelled: ${reason}`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...updated };
  }
}

export const syntheticOrderRepository = new SyntheticOrderRepository();
