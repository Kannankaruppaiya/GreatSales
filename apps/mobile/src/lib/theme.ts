import { useColorScheme } from 'react-native';

/**
 * Semantic color palette for the GreatSales app, resolved per color scheme.
 * Screens read colors through {@link useColors} so light/dark is automatic.
 */
export interface AppColors {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
  tint: string;
  tabInactive: string;
}

const palette: { light: AppColors; dark: AppColors } = {
  light: {
    bg: '#F5F6F8',
    card: '#FFFFFF',
    cardAlt: '#F0F2F5',
    border: '#E2E5EA',
    text: '#11181C',
    textMuted: '#5B6470',
    primary: '#2563EB',
    primaryText: '#FFFFFF',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    tint: '#2563EB',
    tabInactive: '#8A929E',
  },
  dark: {
    bg: '#0B0D10',
    card: '#15181D',
    cardAlt: '#1D2127',
    border: '#282D35',
    text: '#ECEDEE',
    textMuted: '#9BA1AC',
    primary: '#3B82F6',
    primaryText: '#FFFFFF',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    tint: '#3B82F6',
    tabInactive: '#6B7280',
  },
};

export function useColors(): AppColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}

export const radius = { sm: 8, md: 12, lg: 16 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Accent colors for the various domain enums, used by status pills. */
export const stageColor: Record<string, string> = {
  NewEnquiries: '#2563EB',
  NeedsAnalysis: '#0891B2',
  TrialsAndSampleTests: '#7C3AED',
  ProposalsAndPriceQuote: '#D97706',
  NegotiationOralConfirmation: '#DB2777',
  ClosedWon: '#16A34A',
  ClosedLost: '#DC2626',
  NoRequirementOrCold: '#6B7280',
  TrialProblem: '#B45309',
};

export const orderStatusColor: Record<string, string> = {
  Draft: '#6B7280',
  Confirmed: '#2563EB',
  Dispatched: '#7C3AED',
  Delivered: '#0891B2',
  Completed: '#16A34A',
  Cancelled: '#DC2626',
};

export const paymentStatusColor: Record<string, string> = {
  Pending: '#D97706',
  PartiallyPaid: '#0891B2',
  Paid: '#16A34A',
  Overdue: '#DC2626',
};

export const categoryColor: Record<string, string> = {
  Platinum: '#6366F1',
  Gold: '#D97706',
  Silver: '#6B7280',
  Brass: '#B45309',
};
