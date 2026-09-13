import type { ProjectionRepository } from '../interfaces';
import type { ProjectionLine, ProjStatusValue } from '../../domain/types';
import { canonicalState } from './canonical-state';

export class SyntheticProjectionRepository implements ProjectionRepository {
  async list(params?: { search?: string; status?: string; principalId?: string }): Promise<ProjectionLine[]> {
    let result = [...canonicalState.projections];

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.customerName.toLowerCase().includes(q) ||
          p.productName.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      );
    }

    if (params?.status && params.status !== 'ALL') {
      result = result.filter((p) => p.status === params.status);
    }

    if (params?.principalId && params.principalId !== 'ALL') {
      result = result.filter((p) => p.principalId === params.principalId);
    }

    return result;
  }

  async getById(id: string): Promise<ProjectionLine | null> {
    const proj = canonicalState.projections.find((p) => p.id === id);
    return proj ? { ...proj } : null;
  }

  async updateStatus(id: string, status: ProjStatusValue, note?: string): Promise<ProjectionLine> {
    const index = canonicalState.projections.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Projection with ID ${id} not found.`);
    }

    const proj = canonicalState.projections[index];
    const updated: ProjectionLine = {
      ...proj,
      status,
      notes: note ? `${proj.notes ? proj.notes + '\n' : ''}${note}` : proj.notes,
      updatedAt: new Date().toISOString(),
    };
    canonicalState.projections[index] = updated;

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Projection',
      entityId: id,
      customerId: proj.customerId,
      customerName: proj.customerName,
      type: 'stage_change',
      description: `Recurring projection line for ${proj.productName} status updated to ${status}${note ? `: ${note}` : ''}`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: new Date().toISOString(),
    });

    return { ...updated };
  }
}

export const syntheticProjectionRepository = new SyntheticProjectionRepository();
