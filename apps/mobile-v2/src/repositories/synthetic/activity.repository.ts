import type { ActivityRepository } from '../interfaces';
import type { Activity } from '../../domain/types';
import { canonicalState } from './canonical-state';

export class SyntheticActivityRepository implements ActivityRepository {
  async listByCustomer(customerId: string): Promise<Activity[]> {
    return canonicalState.activities
      .filter((a) => a.customerId === customerId)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }

  async listByEntity(entityType: string, entityId: string): Promise<Activity[]> {
    return canonicalState.activities
      .filter((a) => a.entityType === entityType && a.entityId === entityId)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }

  async log(activity: Omit<Activity, 'id' | 'timestamp'>): Promise<Activity> {
    const newActivity: Activity = {
      performedById: canonicalState.currentUser.id,
      performedByName: canonicalState.currentUser.name,
      ...activity,
      id: `act_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    canonicalState.activities.unshift(newActivity);
    return { ...newActivity };
  }
}

export const syntheticActivityRepository = new SyntheticActivityRepository();
