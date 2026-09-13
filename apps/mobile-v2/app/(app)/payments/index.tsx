import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Clock, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSIconButton,
  GSSearchBar,
  GSChip,
  GSAmountDisplay,
  GSSkeleton,
  GSEmptyState,
  GSErrorState,
} from '@/components/ui';
import { PaymentCard } from '@/components/domain';
import { RecordPaymentSheet } from '@/components/modals';
import { usePayments } from '@/hooks';
import type { Payment } from '@/domain/types';

export default function PaymentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { action } = useLocalSearchParams<{ action?: string }>();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING'>('ALL');
  const [recordSheetVisible, setRecordSheetVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Auto-open RecordPaymentSheet when navigated with ?action=record (from new-sale hub)
  useEffect(() => {
    if (action === 'record') {
      setRecordSheetVisible(true);
    }
  }, [action]);

  const { data: payments, isLoading, isError, refetch } = usePayments({ search });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Top Metrics Calculation matching Screen 7
  const { totalPending, overdueAmount, over90DaysAmount } = useMemo(() => {
    if (!payments) return { totalPending: 0, overdueAmount: 0, over90DaysAmount: 0 };
    let total = 0;
    let overdue = 0;
    let over90 = 0;

    for (const p of payments) {
      total += p.amount;
      if (p.status === 'Overdue' || p.agingDays > 0) {
        overdue += p.amount;
      }
      if (p.agingDays > 90 || (p.paymentZone === 'Red' && p.agingDays > 60)) {
        over90 += p.amount;
      }
    }

    return { totalPending: total, overdueAmount: overdue, over90DaysAmount: over90 };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    if (statusFilter === 'OVERDUE') {
      return payments.filter((p) => p.status === 'Overdue' || p.agingDays > 0);
    }
    if (statusFilter === 'DUE_TODAY') {
      return payments.filter((p) => p.agingDays === 0);
    }
    if (statusFilter === 'UPCOMING') {
      return payments.filter((p) => p.agingDays < 0 || p.status === 'Pending');
    }
    return payments;
  }, [payments, statusFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Payments"
        subtitle="Outstanding & collections"
        showBack
        rightActions={
          <GSIconButton
            icon={<Plus size={18} color={colors.white} strokeWidth={2.5} />}
            variant="brand"
            size="sm"
            accessibilityLabel="Record received payment"
            onPress={() => setRecordSheetVisible(true)}
          />
        }
      />

      {/* Top Metrics Strip matching Screen 7 */}
      <View
        style={[
          styles.metricsStrip,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.metricCol}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>TOTAL OUTSTANDING</Text>
          <GSAmountDisplay amount={totalPending} size="md" variant="default" showLakhs />
        </View>

        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />

        <View style={styles.metricCol}>
          <Text style={[styles.metricLabel, { color: colors.danger }]}>OVERDUE</Text>
          <GSAmountDisplay amount={overdueAmount} size="md" variant="danger" showLakhs />
        </View>

        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />

        <View style={styles.metricCol}>
          <Text style={[styles.metricLabel, { color: colors.danger }]}>&gt;90 DAYS</Text>
          <GSAmountDisplay amount={over90DaysAmount} size="md" variant="danger" showLakhs />
        </View>
      </View>

      {/* Search & Filters */}
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <GSSearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by customer, invoice..."
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <GSChip
            label="All"
            selected={statusFilter === 'ALL'}
            onPress={() => setStatusFilter('ALL')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Overdue"
            selected={statusFilter === 'OVERDUE'}
            onPress={() => setStatusFilter('OVERDUE')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Due Today"
            selected={statusFilter === 'DUE_TODAY'}
            onPress={() => setStatusFilter('DUE_TODAY')}
          />
          <View style={{ width: spacing[2] }} />
          <GSChip
            label="Upcoming"
            selected={statusFilter === 'UPCOMING'}
            onPress={() => setStatusFilter('UPCOMING')}
          />
        </ScrollView>
      </View>

      {/* Main List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {isLoading ? (
          <>
            <GSSkeleton height={130} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
            <GSSkeleton height={130} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
            <GSSkeleton height={130} borderRadius={radius.lg} />
          </>
        ) : isError ? (
          <GSErrorState onRetry={refetch} />
        ) : filteredPayments.length === 0 ? (
          <GSEmptyState
            title="No Invoices Found"
            description="No pending receivables match your search or zone selection."
          />
        ) : (
          filteredPayments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              onPress={() => router.push(`/(app)/payments/${payment.id}` as any)}
            />
          ))
        )}
      </ScrollView>

      {(() => {
        const activePayment = selectedPayment || filteredPayments[0] || payments?.[0];
        return (
          <RecordPaymentSheet
            visible={recordSheetVisible}
            onClose={() => {
              setRecordSheetVisible(false);
              setSelectedPayment(null);
            }}
            paymentId={activePayment?.id || 'synthetic-pay-1'}
            invoiceCode={activePayment?.invoiceCode ?? activePayment?.invoiceNo ?? 'INV-NEW'}
            customerName={activePayment?.customerName || 'Selected Customer'}
            outstandingAmount={activePayment?.amount || 50000}
          />
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
  },
  metricDivider: {
    width: 1,
    height: 32,
    marginHorizontal: spacing[3],
  },
  searchBox: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingTop: spacing[2],
  },
  listContent: {
    padding: spacing[4],
  },
});
