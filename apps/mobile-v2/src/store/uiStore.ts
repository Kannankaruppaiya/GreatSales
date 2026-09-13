import { create } from 'zustand';

interface UiState {
  // Navigation / Filter states
  customerSearch: string;
  customerCategoryFilter: string;
  customerAreaFilter: string;
  customerPayZoneFilter: string;

  leadSearch: string;
  leadStageFilter: string;

  orderSearch: string;
  orderStatusFilter: string;

  paymentSearch: string;
  paymentStatusFilter: string;
  paymentZoneFilter: string;

  followUpFilter: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';
  followUpEntityFilter: string;

  mappingSearch: string;

  // Setters
  setCustomerSearch: (v: string) => void;
  setCustomerFilters: (f: { category?: string; area?: string; payZone?: string }) => void;
  resetCustomerFilters: () => void;

  setLeadSearch: (v: string) => void;
  setLeadStageFilter: (v: string) => void;

  setOrderSearch: (v: string) => void;
  setOrderStatusFilter: (v: string) => void;

  setPaymentSearch: (v: string) => void;
  setPaymentFilters: (f: { status?: string; payZone?: string }) => void;
  resetPaymentFilters: () => void;

  setFollowUpFilter: (v: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed') => void;
  setFollowUpEntityFilter: (v: string) => void;

  setMappingSearch: (v: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  customerSearch: '',
  customerCategoryFilter: 'ALL',
  customerAreaFilter: 'ALL',
  customerPayZoneFilter: 'ALL',

  leadSearch: '',
  leadStageFilter: 'ALL',

  orderSearch: '',
  orderStatusFilter: 'ALL',

  paymentSearch: '',
  paymentStatusFilter: 'ALL',
  paymentZoneFilter: 'ALL',

  followUpFilter: 'today',
  followUpEntityFilter: 'ALL',

  mappingSearch: '',

  setCustomerSearch: (customerSearch) => set({ customerSearch }),
  setCustomerFilters: (filters) =>
    set((state) => ({
      customerCategoryFilter: filters.category ?? state.customerCategoryFilter,
      customerAreaFilter: filters.area ?? state.customerAreaFilter,
      customerPayZoneFilter: filters.payZone ?? state.customerPayZoneFilter,
    })),
  resetCustomerFilters: () =>
    set({
      customerCategoryFilter: 'ALL',
      customerAreaFilter: 'ALL',
      customerPayZoneFilter: 'ALL',
    }),

  setLeadSearch: (leadSearch) => set({ leadSearch }),
  setLeadStageFilter: (leadStageFilter) => set({ leadStageFilter }),

  setOrderSearch: (orderSearch) => set({ orderSearch }),
  setOrderStatusFilter: (orderStatusFilter) => set({ orderStatusFilter }),

  setPaymentSearch: (paymentSearch) => set({ paymentSearch }),
  setPaymentFilters: (filters) =>
    set((state) => ({
      paymentStatusFilter: filters.status ?? state.paymentStatusFilter,
      paymentZoneFilter: filters.payZone ?? state.paymentZoneFilter,
    })),
  resetPaymentFilters: () =>
    set({
      paymentStatusFilter: 'ALL',
      paymentZoneFilter: 'ALL',
    }),

  setFollowUpFilter: (followUpFilter) => set({ followUpFilter }),
  setFollowUpEntityFilter: (followUpEntityFilter) => set({ followUpEntityFilter }),

  setMappingSearch: (mappingSearch) => set({ mappingSearch }),
}));
