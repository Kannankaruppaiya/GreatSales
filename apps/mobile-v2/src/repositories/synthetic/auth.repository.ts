import type { AuthRepository } from '../interfaces';
import type { User } from '../../domain/types';
import { canonicalState } from './canonical-state';

export class SyntheticAuthRepository implements AuthRepository {
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const user = canonicalState.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase().trim(),
    );
    if (!user) {
      throw new Error('Invalid email or password.');
    }
    // Demo credential acceptance
    if (password !== '1234' && password !== 'admin') {
      throw new Error('Invalid email or password.');
    }
    canonicalState.currentUser = user;
    return {
      user,
      token: `demo_jwt_token_${user.id}_${Date.now()}`,
    };
  }

  async logout(): Promise<void> {
    // Keep user state but mark signed out if needed
  }

  async getCurrentUser(): Promise<User | null> {
    return canonicalState.currentUser;
  }

  async changePassword(oldPw: string, newPw: string): Promise<void> {
    if (oldPw !== '1234' && oldPw !== 'admin') {
      throw new Error('Current password does not match.');
    }
    if (newPw.length < 4) {
      throw new Error('New password must be at least 4 characters.');
    }
  }

  async updateProfile(input: { name?: string; phone?: string }): Promise<User> {
    const user = canonicalState.currentUser;
    if (input.name) user.name = input.name;
    if (input.phone) user.phone = input.phone;
    return { ...user };
  }

  async updateAvatar(uri: string): Promise<string> {
    canonicalState.currentUser.avatarUrl = uri;
    return uri;
  }

  async removeAvatar(): Promise<void> {
    canonicalState.currentUser.avatarUrl = null;
  }
}

export const syntheticAuthRepository = new SyntheticAuthRepository();
