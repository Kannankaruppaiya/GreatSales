import type { MappingRepository } from '../interfaces';
import type { Mapping } from '../../domain/types';
import { canonicalState } from './canonical-state';

export class SyntheticMappingRepository implements MappingRepository {
  async list(params?: { search?: string; customerId?: string; principalId?: string }): Promise<Mapping[]> {
    let result = [...canonicalState.mappings];

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.customerName.toLowerCase().includes(q) ||
          m.productName.toLowerCase().includes(q) ||
          (m.productSku && m.productSku.toLowerCase().includes(q)),
      );
    }

    if (params?.customerId && params.customerId !== 'ALL') {
      result = result.filter((m) => m.customerId === params.customerId);
    }

    if (params?.principalId && params.principalId !== 'ALL') {
      result = result.filter((m) => m.principalId === params.principalId);
    }

    return result;
  }

  async getById(id: string): Promise<Mapping | null> {
    const map = canonicalState.mappings.find((m) => m.id === id);
    return map ? { ...map } : null;
  }

  async create(input: Omit<Mapping, 'id' | 'createdAt' | 'updatedAt'>): Promise<Mapping> {
    const id = `map_${Date.now()}`;
    const now = new Date().toISOString();

    const newMapping: Mapping = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    };

    canonicalState.mappings.unshift(newMapping);

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Customer',
      entityId: input.customerId,
      customerId: input.customerId,
      customerName: input.customerName,
      type: 'remark',
      description: `New product pricing mapping added: ${input.productName} (Effective: ₹${input.effectivePrice}/L)`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...newMapping };
  }

  async updatePrice(id: string, customPrice: number | null): Promise<Mapping> {
    const index = canonicalState.mappings.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error(`Mapping with ID ${id} not found.`);
    }

    const m = canonicalState.mappings[index];
    const effectivePrice = customPrice != null ? customPrice : (m.catalogPrice ?? m.basePrice ?? 0);
    const now = new Date().toISOString();

    const updated: Mapping = {
      ...m,
      customPrice,
      effectivePrice,
      updatedAt: now,
    };
    canonicalState.mappings[index] = updated;

    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    const index = canonicalState.mappings.findIndex((m) => m.id === id);
    if (index !== -1) {
      canonicalState.mappings.splice(index, 1);
    }
  }
}

export const syntheticMappingRepository = new SyntheticMappingRepository();
