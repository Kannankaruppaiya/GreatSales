import { useQuery } from '@tanstack/react-query';
import { productRepo } from '../repositories';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => productRepo.list(),
  });
}

export function usePrincipals() {
  return useQuery({
    queryKey: ['principals'],
    queryFn: () => productRepo.listPrincipals(),
  });
}
