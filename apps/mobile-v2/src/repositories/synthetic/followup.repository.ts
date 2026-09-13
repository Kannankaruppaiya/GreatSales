import type { FollowUpRepository } from '../interfaces';
import type { FollowUp } from '../../domain/types';
import { canonicalState } from './canonical-state';
import { getTodayIso } from '../../domain/calculations';

export class SyntheticFollowUpRepository implements FollowUpRepository {
  async list(params?: {
    filter?: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';
    entityType?: string;
  }): Promise<FollowUp[]> {
    let result = [...canonicalState.followups];
    const today = getTodayIso();

    if (params?.filter === 'overdue') {
      result = result.filter((f) => !f.done && f.dueDate < today);
    } else if (params?.filter === 'today') {
      result = result.filter((f) => !f.done && f.dueDate === today);
    } else if (params?.filter === 'upcoming') {
      result = result.filter((f) => !f.done && f.dueDate > today);
    } else if (params?.filter === 'completed') {
      result = result.filter((f) => f.done);
    }

    if (params?.entityType && params.entityType !== 'ALL') {
      result = result.filter((f) => f.entityType === params.entityType);
    }

    return result.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  }

  async getById(id: string): Promise<FollowUp | null> {
    const fu = canonicalState.followups.find((f) => f.id === id);
    return fu ? { ...fu } : null;
  }

  async create(input: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>): Promise<FollowUp> {
    const id = `fu_${Date.now()}`;
    const now = new Date().toISOString();

    const newFollowUp: FollowUp = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    };

    canonicalState.followups.unshift(newFollowUp);

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: input.entityType,
      entityId: input.entityId,
      customerId: '',
      customerName: input.title,
      type: 'followup',
      description: `Follow-up scheduled: ${input.title} for ${input.dueDate}`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...newFollowUp };
  }

  async complete(id: string, outcomeNote?: string): Promise<FollowUp> {
    const index = canonicalState.followups.findIndex((f) => f.id === id);
    if (index === -1) {
      throw new Error(`Follow-up with ID ${id} not found.`);
    }

    const fu = canonicalState.followups[index];
    const now = new Date().toISOString();

    const updated: FollowUp = {
      ...fu,
      done: true,
      status: 'Completed',
      note: outcomeNote ? `${fu.note ? fu.note + '\n' : ''}Completed: ${outcomeNote}` : fu.note,
      updatedAt: now,
    };
    canonicalState.followups[index] = updated;

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: fu.entityType,
      entityId: fu.entityId,
      customerId: '',
      customerName: fu.title,
      type: 'followup',
      description: `Follow-up completed: ${fu.title}${outcomeNote ? ` — ${outcomeNote}` : ''}`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...updated };
  }

  async snooze(id: string, days: number): Promise<FollowUp> {
    const index = canonicalState.followups.findIndex((f) => f.id === id);
    if (index === -1) {
      throw new Error(`Follow-up with ID ${id} not found.`);
    }

    const fu = canonicalState.followups[index];
    const currDate = new Date(fu.dueDate);
    currDate.setDate(currDate.getDate() + days);
    const newDueDate = `${currDate.getFullYear()}-${String(currDate.getMonth() + 1).padStart(2, '0')}-${String(currDate.getDate()).padStart(2, '0')}`;
    const now = new Date().toISOString();

    const updated: FollowUp = {
      ...fu,
      dueDate: newDueDate,
      updatedAt: now,
    };
    canonicalState.followups[index] = updated;

    // Cross-module activity log
    canonicalState.activities.unshift({
      id: `act_${Date.now()}`,
      entityType: fu.entityType,
      entityId: fu.entityId,
      customerId: '',
      customerName: fu.title,
      type: 'followup',
      description: `Follow-up snoozed by ${days} day(s) to ${newDueDate}`,
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      timestamp: now,
    });

    return { ...updated };
  }
}

export const syntheticFollowUpRepository = new SyntheticFollowUpRepository();
