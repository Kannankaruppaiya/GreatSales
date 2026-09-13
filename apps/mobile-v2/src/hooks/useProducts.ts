import { useQuery } from '@tanstack/react-query';
import { syntheticProductRepository } from '../repositories/synthetic';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => syntheticProductRepository.list(),
  });
}

export function usePrincipals() {
  return useQuery({
    queryKey: ['principals'],
    queryFn: () => syntheticProductRepository.listPrincipals(),
  });
}
