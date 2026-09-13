import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Truck,
  Calendar,
  ArrowUpRight,
  Package,
  AlertOctagon,
  CheckCircle2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSAmountDisplay,
  GSStatusIndicator,
  GSTimeline,
  GSSkeleton,
  GSErrorState,
  GSButton,
} from '@/components/ui';
import { AdvanceOrderStatusSheet, CancelOrderDialog } from '@/components/modals';
import { useOrder } from '@/hooks';
import { formatCurrencyINR, formatShortDate } from '@/domain/formatters';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: order, isLoading, isError, refetch } = useOrder(id || '');
  const [advanceSheetVisible, setAdvanceSheetVisible] = useState(false);
  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Order Detail" showBack />
        <View style={{ padding: spacing[4] }}>
          <GSSkeleton height={160} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={120} borderRadius={radius.md} />
        </View>
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Order Detail" showBack />
        <GSErrorState title="Order not found" onRetry={refetch} />
      </View>
    );
  }

  const isCancelled = order.status === 'Cancelled';
  const isDelivered = order.status === 'DeliveredFromWarehouse';

  const timelineItems = [
    {
      id: 'step-created',
      title: 'Order Created',
      subtitle: `Recorded on ${formatShortDate(order.createdAt)}`,
      completed: true,
    },
    {
      id: 'step-ack',
      title: 'Order Acknowledged',
      subtitle: 'Verified by supply desk',
      completed: order.status !== 'Created' && !isCancelled,
      active: order.status === 'Acknowledged',
    },
    {
      id: 'step-dispatch',
      title: 'Dispatched & In-Transit',
      subtitle: order.transporter ? `Shipped via ${order.transporter}` : 'Awaiting transporter assignment',
      completed: (order.status === 'Dispatched' || isDelivered) && !isCancelled,
      active: order.status === 'Dispatched',
    },
    {
      id: 'step-delivered',
      title: 'Delivered from Warehouse',
      subtitle: 'Delivery receipt confirmed',
      completed: isDelivered,
      active: isDelivered,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title={order.code}
        subtitle={order.customerName}
        showBack
        rightActions={
          !isCancelled && !isDelivered ? (
            <GSButton
              title="Cancel"
              variant="ghost"
              size="sm"
              onPress={() => setCancelDialogVisible(true)}
            />
          ) : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* Order Status & Financial Summary Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open customer ${order.customerName}`}
                onPress={() => router.push(`/(app)/customers/${order.customerId}` as any)}
                style={styles.customerLink}
              >
                <Text style={[styles.customerName, { color: colors.brand }]}>
                  {order.customerName}
                </Text>
                <ArrowUpRight size={16} color={colors.brand} />
              </Pressable>
              <Text style={[styles.orderCode, { color: colors.textPrimary }]}>
                {order.code}
              </Text>
            </View>

            <GSStatusIndicator status={order.status} type="order" />
          </View>

          {/* Grand Total */}
          <View
            style={[
              styles.totalStrip,
              { backgroundColor: colors.surfaceInteractive, borderColor: colors.borderSubtle },
            ]}
          >
            <View>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>GRAND TOTAL (INCL. GST)</Text>
              <GSAmountDisplay amount={order.total} size="hero" variant="default" showLakhs />
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.microLabel, { color: colors.textTertiary }]}>SUBTOTAL</Text>
              <Text style={[styles.subtotalText, { color: colors.textSecondary }]}>
                {formatCurrencyINR(order.subtotal)}
              </Text>
            </View>
          </View>

          {/* Status Progression Action */}
          {!isCancelled && !isDelivered && (
            <GSButton
              title="Advance Fulfillment Status"
              variant="primary"
              size="md"
              onPress={() => setAdvanceSheetVisible(true)}
              style={{ marginTop: spacing[3] }}
            />
          )}
        </View>

        {/* Fulfillment Timeline */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Fulfillment Progression
          </Text>
          <GSTimeline items={timelineItems} />
        </View>

        {/* Line Items List */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Order Line Items ({order.items.length})
          </Text>

          {order.items.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.itemRow,
                idx < order.items.length - 1 && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                  {item.productName}
                </Text>
                <Text style={[styles.itemSku, { color: colors.textSecondary }]}>
                  SKU: {item.sku} • Qty: {item.quantity ?? item.qty} units @ {formatCurrencyINR(item.rate ?? item.price ?? 0)}
                </Text>
              </View>

              <Text style={[styles.itemTotal, { color: colors.textPrimary }]}>
                {formatCurrencyINR(item.subtotal ?? item.lineTotal ?? 0)}
              </Text>
            </View>
          ))}

          {/* Breakdown summary */}
          <View style={[styles.breakdownBox, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Subtotal</Text>
              <Text style={[styles.breakdownVal, { color: colors.textPrimary }]}>
                {formatCurrencyINR(order.subtotal)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Estimated GST (18%)</Text>
              <Text style={[styles.breakdownVal, { color: colors.textPrimary }]}>
                {formatCurrencyINR(order.tax ?? order.taxAmount ?? 0)}
              </Text>
            </View>
            <View style={[styles.breakdownRow, { marginTop: 4 }]}>
              <Text style={[styles.breakdownLabel, { color: colors.textPrimary, fontWeight: '700' }]}>Total</Text>
              <Text style={[styles.breakdownVal, { color: colors.brand, fontWeight: '800' }]}>
                {formatCurrencyINR(order.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Logistics & Delivery Details */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Logistics & Delivery
          </Text>

          <View style={[styles.logisticsRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.logisticsLabel, { color: colors.textSecondary }]}>Transporter</Text>
            <Text style={[styles.logisticsVal, { color: colors.textPrimary }]}>
              {order.transporter || 'Self Pick-up / Standard'}
            </Text>
          </View>

          <View style={[styles.logisticsRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.logisticsLabel, { color: colors.textSecondary }]}>Delivery Address</Text>
            <Text style={[styles.logisticsVal, { color: colors.textPrimary, flex: 1, textAlign: 'right' }]}>
              {order.deliveryAddress || 'Registered Factory Premises'}
            </Text>
          </View>

          {order.expectedDelivery && (
            <View style={[styles.logisticsRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.logisticsLabel, { color: colors.textSecondary }]}>Expected Delivery</Text>
              <Text style={[styles.logisticsVal, { color: colors.brand, fontWeight: '700' }]}>
                {formatShortDate(order.expectedDelivery)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Advance Status Sheet */}
      <AdvanceOrderStatusSheet
        visible={advanceSheetVisible}
        onClose={() => setAdvanceSheetVisible(false)}
        orderId={order.id}
        orderCode={order.code}
        currentStatus={order.status}
      />

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        visible={cancelDialogVisible}
        onClose={() => setCancelDialogVisible(false)}
        orderId={order.id}
        orderCode={order.code}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
  },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  customerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  customerName: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    marginRight: 4,
  },
  orderCode: {
    fontSize: typography.heading2.fontSize,
    fontWeight: '800',
  },
  totalStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  microLabel: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subtotalText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
    marginBottom: spacing[3],
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  itemName: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  itemSku: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  breakdownBox: {
    borderTopWidth: 1,
    paddingTop: spacing[3],
    marginTop: spacing[2],
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: typography.caption.fontSize,
  },
  breakdownVal: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  logisticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  logisticsLabel: {
    fontSize: typography.bodySmall.fontSize,
  },
  logisticsVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
});
