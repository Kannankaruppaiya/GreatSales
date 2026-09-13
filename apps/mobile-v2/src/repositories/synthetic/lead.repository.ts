import type { LeadRepository } from '../interfaces';
import type { Lead, DealStageValue } from '../../domain/types';
import { canonicalState } from './canonical-state';

export class SyntheticLeadRepository implements LeadRepository {
  async list(params?: { search?: string; stage?: string; salespersonId?: string }): Promise<Lead[]> {
    let result = [...canonicalState.leads];

    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.customerName.toLowerCase().includes(q) ||
          (l.contactName?.toLowerCase().includes(q) ?? false) ||
          (l.products?.some((p) => p.productName.toLowerCase().includes(q)) ?? false) ||
          (l.productName?.toLowerCase().includes(q) ?? false),
      );
    }

    if (params?.stage && params.stage !== 'ALL') {
      result = result.filter((l) => l.stage === params.stage);
    }

    if (params?.salespersonId && params.salespersonId !== 'ALL') {
      result = result.filter((l) => l.salespersonId === params.salespersonId);
    }

    return result;
  }

  async getById(id: string): Promise<Lead | null> {
    const lead = canonicalState.leads.find((l) => l.id === id);
    return lead ? { ...lead } : null;
  }

  async create(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'stageUpdatedAt'>): Promise<Lead> {
    const id = `lead_${Date.now()}`;
    const now = new Date().toISOString();
    const newLead: Lead = {
      ...input,
      id,
      stageUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    canonicalState.leads.unshift(newLead);

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Lead',
      entityId: id,
      customerId: '',
      customerName: newLead.customerName,
      type: 'remark',
      description: `New sales opportunity created for ${newLead.customerName} (₹${(newLead.totalValue ?? newLead.value ?? 0).toLocaleString('en-IN')})`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...newLead };
  }

  async update(id: string, input: Partial<Lead>): Promise<Lead> {
    const index = canonicalState.leads.findIndex((l) => l.id === id);
    if (index === -1) {
      throw new Error(`Lead with ID ${id} not found.`);
    }

    const updated = {
      ...canonicalState.leads[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    canonicalState.leads[index] = updated;

    return { ...updated };
  }

  async changeStage(id: string, stage: DealStageValue, note?: string): Promise<Lead> {
    const index = canonicalState.leads.findIndex((l) => l.id === id);
    if (index === -1) {
      throw new Error(`Lead with ID ${id} not found.`);
    }

    const lead = canonicalState.leads[index];
    const prevStage = lead.stage;
    const now = new Date().toISOString();

    const updated: Lead = {
      ...lead,
      stage,
      stageUpdatedAt: now,
      updatedAt: now,
      probability: stage === 'ClosedWon' ? 100 : stage === 'NegotiationOralConfirmation' ? 90 : lead.probability,
    };
    canonicalState.leads[index] = updated;

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Lead',
      entityId: id,
      customerId: '',
      customerName: lead.customerName,
      type: 'stage_change',
      description: `Stage moved from ${prevStage} to ${stage}${note ? `: ${note}` : ''}`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...updated };
  }

  async addRemark(id: string, note: string): Promise<void> {
    const lead = canonicalState.leads.find((l) => l.id === id);
    if (!lead) return;

    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: 'Lead',
      entityId: id,
      customerId: '',
      customerName: lead.customerName,
      type: 'remark',
      description: note,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: new Date().toISOString(),
    });
  }
}

export const syntheticLeadRepository = new SyntheticLeadRepository();
