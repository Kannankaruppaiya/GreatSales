import type { NotificationRepository } from '../interfaces';
import type { Notification } from '../../domain/types';
import { canonicalState } from './canonical-state';

export class SyntheticNotificationRepository implements NotificationRepository {
  async list(): Promise<Notification[]> {
    return [...canonicalState.notifications];
  }

  async markAsRead(id: string): Promise<void> {
    const notif = canonicalState.notifications.find((n) => n.id === id);
    if (notif) {
      notif.isRead = true;
    }
  }

  async markAllAsRead(): Promise<void> {
    canonicalState.notifications.forEach((n) => {
      n.isRead = true;
    });
  }
}

export const syntheticNotificationRepository = new SyntheticNotificationRepository();
