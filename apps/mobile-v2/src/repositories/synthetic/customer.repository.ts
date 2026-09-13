import type { CustomerRepository } from '../interfaces';
import type { Customer } from '../../domain/types';
import { canonicalState } from './canonical-state';

export class SyntheticCustomerRepository implements CustomerRepository {
  async list(params?: { search?: string; category?: string; area?: string; payZone?: string }): Promise<Customer[]> {
    let result = [...canonicalState.customers];

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.area?.toLowerCase().includes(q) ?? false) ||
          (c.city?.toLowerCase().includes(q) ?? false) ||
          (c.primaryContactName?.toLowerCase().includes(q) ?? false),
      );
    }

    if (params?.category && params.category !== 'ALL') {
      result = result.filter((c) => c.category === params.category);
    }

    if (params?.area && params.area !== 'ALL') {
      result = result.filter((c) => c.area === params.area);
    }

    if (params?.payZone && params.payZone !== 'ALL') {
      result = result.filter((c) => c.payZone === params.payZone);
    }

    return result;
  }

  async getById(id: string): Promise<Customer | null> {
    const customer = canonicalState.customers.find((c) => c.id === id);
    return customer ? { ...customer } : null;
  }

  async create(input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const id = `cust_${Date.now()}`;
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    };
    canonicalState.customers.unshift(newCustomer);

    // Also log activity
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Customer',
      entityId: id,
      customerId: id,
      customerName: newCustomer.name,
      type: 'remark',
      description: `Customer account created: ${newCustomer.name}`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...newCustomer };
  }

  async update(id: string, input: Partial<Customer>): Promise<Customer> {
    const index = canonicalState.customers.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Customer with ID ${id} not found.`);
    }

    const updated = {
      ...canonicalState.customers[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    canonicalState.customers[index] = updated;

    return { ...updated };
  }

  async checkDuplicates(name: string, phone?: string): Promise<Customer[]> {
    const q = name.toLowerCase().trim();
    return canonicalState.customers.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase());
      const matchPhone = phone && c.primaryContactPhone ? c.primaryContactPhone.includes(phone) : false;
      return matchName || matchPhone;
    });
  }
}

export const syntheticCustomerRepository = new SyntheticCustomerRepository();
