import type { ProductRepository } from '../interfaces';
import type { Product, Principal } from '../../domain/types';
import { SYNTHETIC_PRODUCTS, SYNTHETIC_PRINCIPALS } from '../../data/synthetic/products';

export class SyntheticProductRepository implements ProductRepository {
  async list(): Promise<Product[]> {
    return [...SYNTHETIC_PRODUCTS];
  }

  async listPrincipals(): Promise<Principal[]> {
    return [...SYNTHETIC_PRINCIPALS];
  }

  async getById(id: string): Promise<Product | null> {
    return SYNTHETIC_PRODUCTS.find((p) => p.id === id) || null;
  }
}

export const syntheticProductRepository = new SyntheticProductRepository();
