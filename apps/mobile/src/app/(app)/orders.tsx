import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Chip, Empty, Kpi, KpiStrip } from '@/gs/kit';
import { Sheet, Field, Input, ModalBtn } from '@/gs/modal';
import { C } from '@/gs/theme';
import { useDebounced } from '@/gs/useDebounced';
import { useOrders, useUpdateOrder, useDeleteOrder, type OrderRow } from '@/gs/queries/orders';
import { DeleteButton } from '@/gs/DeleteButton';
import { inr, lakhs, shortDate, soTone } from '@/gs/domain';
import { SearchIcon } from '@/gs/icons';
import { ORDER_STATUS_VALUES, type OrderStatusValue } from '@greatsales/shared';

const TIMELINE_STATUSES = ORDER_STATUS_VALUES.filter(
  (s) => s !== 'Cancelled',
) as Exclude<OrderStatusValue, 'Cancelled'>[];

const STATUS_LABELS: Record<OrderStatusValue, string> = {
  Created: 'Created',
  Acknowledged: 'Acknowledged',
  DeliveryPartnerAssigned: 'Partner Assigned',
  DeliveredFromWarehouse: 'Delivered from WH',
  DeliveredToCustomer: 'Delivered to Cust',
  CustomerReceiptConfirmed: 'Receipt Confirmed',
  Cancelled: 'Cancelled',
};

export default function Orders() {
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounced(searchText, 300);
  // The report tab totals the whole ledger, and the status chips count across
  // it, so every page of the filtered set is fetched.
  const {
    items: orders,
    total,
    isLoadingAll: isLoading,
    refetch,
  } = useOrders(
    { search: debouncedSearch.trim() || undefined },
    { autoFetchAll: true },
  );
  const [tab, setTab] = useState<'list' | 'report'>('list');
  const [chip, setChip] = useState<string>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const deleteOrder = useDeleteOrder();

  const rows = useMemo(() => orders.filter((o) => {
    if (chip !== 'ALL' && o.status !== chip) return false;
    return true;
  }), [orders, chip]);

  const open = orders.find((o) => o.id === openId) || null;
  const inTransit = orders.filter((o) => !['CustomerReceiptConfirmed', 'Created', 'Cancelled'].includes(o.status)).length;
  const urgent = orders.filter((o) => o.isUrgent).length;
  const completed = orders.filter((o) => o.status === 'CustomerReceiptConfirmed').length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Sticky Zones 1-3 */}
      <View className="bg-canvas border-b border-line/50 px-4 pt-2 pb-0 gap-1">
        {/* Zone 1 */}
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Pressable onPress={() => router.back()} hitSlop={12} className="flex-row items-center gap-0.5 mb-0.5">
              <Text className="text-brand font-black text-xs">‹ Dashboard</Text>
            </Pressable>
            <Text className="text-[20px] font-black text-ink tracking-tight">Sales Orders</Text>
          </View>
        </View>
        {/* Zone 2 — KPI Strip */}
        <View className="mb-1.5">
          <KpiStrip items={[
            { label: 'Total Orders', value: String(orders.length) },
            { label: 'In Transit', value: String(inTransit), accent: inTransit > 0 },
            { label: 'Urgent', value: String(urgent), alert: urgent > 0 },
            { label: 'Completed', value: String(completed) },
          ]} />
        </View>
        {/* Zone 3 — Tab + Status Chips */}
        <View className="gap-2 pb-2">
          <View className="flex-row gap-2 p-1 bg-surface3 rounded-xl">
            <Pressable onPress={() => setTab('list')} className={`flex-1 py-1.5 rounded-lg items-center ${tab === 'list' ? 'bg-surface shadow-sm' : ''}`}>
              <Text className={`text-xs font-extrabold ${tab === 'list' ? 'text-ink' : 'text-muted'}`}>Orders ({orders.length})</Text>
            </Pressable>
            <Pressable onPress={() => setTab('report')} className={`flex-1 py-1.5 rounded-lg items-center ${tab === 'report' ? 'bg-surface shadow-sm' : ''}`}>
              <Text className={`text-xs font-extrabold ${tab === 'report' ? 'text-ink' : 'text-muted'}`}>SLA Report</Text>
            </Pressable>
          </View>
          <View className="flex-row items-center bg-surface border border-line rounded-xl px-3 py-2.5">
            <SearchIcon size={16} color="#64748b" />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search SO code or customer…"
              placeholderTextColor={C.faint}
              className="flex-1 ml-2 text-[13px] text-ink font-medium"
              autoCapitalize="none"
            />
            {searchText ? <Pressable onPress={() => setSearchText('')} hitSlop={8}><Text className="text-muted font-bold text-sm">✕</Text></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            <Chip key="ALL" label="All Orders" count={orders.length} active={chip === 'ALL'} onPress={() => setChip('ALL')} />
            {ORDER_STATUS_VALUES.map((s) => (
              <Chip key={s} label={STATUS_LABELS[s] || s} count={orders.filter((o) => o.status === s).length} active={chip === s} onPress={() => setChip(s)} />
            ))}
          </ScrollView>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={C.brand} />
          <Text className="text-xs text-muted font-medium mt-3">Loading sales orders…</Text>
        </View>
      ) : tab === 'report' ? (
        <Report orders={orders} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(o) => o.id}
          contentContainerClassName="p-4 pb-28 gap-2.5"
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => <OrderCard o={item} onPress={() => setOpenId(item.id)} />}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={<Empty text="No sales orders match." />}
        />
      )}

      {/* Order Detail Sheet */}
      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.code || ''}
        subtitle={open ? `${open.customerName} · ${inr(open.total)}` : ''}
        footer={
          <>
            {open ? (
              <DeleteButton
                label="Delete"
                title={`Delete ${open.code}?`}
                body="The order and its line items are removed, and it stops counting towards achievement. To keep the record, cancel it instead."
                onDelete={() => deleteOrder.mutateAsync(open.id)}
                onDeleted={() => setOpenId(null)}
              />
            ) : null}
            <ModalBtn label="Close" variant="ghost" onPress={() => setOpenId(null)} />
          </>
        }
      >
        {open ? <OrderDetail o={open} onClose={() => setOpenId(null)} /> : null}
      </Sheet>
    </SafeAreaView>
  );
}

function OrderCard({ o, onPress }: { o: OrderRow; onPress: () => void }) {
  const currentIdx = TIMELINE_STATUSES.indexOf(o.status as (typeof TIMELINE_STATUSES)[number]);
  const productSummary = o.items.map((it) => `${it.productName} (x${it.qty})`).join(', ') || 'No items';

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-[14px] font-black text-ink">{o.code}</Text>
            {o.isUrgent ? <Badge label="Urgent" tone="lost" small /> : null}
          </View>
          <Text className="text-xs text-muted font-medium mt-0.5">{o.customerName}</Text>
          <Text className="text-[11px] text-ink2 font-semibold mt-0.5" numberOfLines={1}>{productSummary}</Text>
        </View>
        <Text className="text-[15px] font-black text-brand">{inr(o.total)}</Text>
      </View>

      {/* Progress Dots */}
      <View className="flex-row items-center gap-1 mt-2.5">
        {TIMELINE_STATUSES.map((_, i) => (
          <View
            key={i}
            className={`flex-1 h-1.5 rounded-full ${
              i < currentIdx ? 'bg-brand' : i === currentIdx ? 'bg-amber' : 'bg-surface3'
            }`}
          />
        ))}
        <Text className="text-[10px] text-muted font-bold ml-1">
          {currentIdx >= 0 ? `${currentIdx + 1}/${TIMELINE_STATUSES.length}` : '—'}
        </Text>
      </View>

      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-line/80 gap-2">
        <Badge label={STATUS_LABELS[o.status] || o.status} tone={soTone(o.status)} small showDot />
        <Text className="text-[11px] text-muted font-semibold">
          {o.deliveryMode || 'Road'} {o.expectedDelivery ? `· ETA ${shortDate(o.expectedDelivery)}` : ''}
        </Text>
      </View>
    </Card>
  );
}

function OrderDetail({ o, onClose }: { o: OrderRow; onClose: () => void }) {
  const updateOrder = useUpdateOrder();
  const [partner, setPartner] = useState(o.transporterName || '');
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const currentIdx = TIMELINE_STATUSES.indexOf(o.status as (typeof TIMELINE_STATUSES)[number]);
  const nextStep: OrderStatusValue | null =
    currentIdx >= 0 && currentIdx < TIMELINE_STATUSES.length - 1
      ? TIMELINE_STATUSES[currentIdx + 1]
      : null;

  const needsPartner = o.status === 'Acknowledged' || nextStep === 'DeliveryPartnerAssigned';

  const handleAdvance = () => {
    if (!nextStep) return;
    const isAssigningTransporter = nextStep === 'DeliveryPartnerAssigned' && partner.trim();
    updateOrder.mutate({
      id: o.id,
      patch: {
        status: nextStep,
        ...(isAssigningTransporter ? {
          transporterName: partner.trim(),
          statusNote: `Transporter assigned: ${partner.trim()}`,
        } : {}),
      },
    });
  };

  const handleCancel = () => {
    if (!reason.trim()) return;
    updateOrder.mutate({
      id: o.id,
      patch: {
        status: 'Cancelled',
        cancelReason: reason.trim(),
      },
    }, {
      onSuccess: () => {
        setCancelling(false);
      },
    });
  };

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-y-3 bg-surface3/60 rounded-xl p-3">
        <Info label="Order Status" value={STATUS_LABELS[o.status] || o.status} />
        <Info label="Total Value" value={inr(o.total)} strong />
        <Info label="Items Count" value={`${o.items.length} item(s)`} />
        <Info label="Delivery Mode" value={o.deliveryMode ?? 'Standard'} />
        <Info label="Ship to" value={o.deliveryAddress ?? o.customerName} />
        <Info label="Expected Delivery" value={o.expectedDelivery ? shortDate(o.expectedDelivery) : '—'} />
      </View>

      {/* Items Breakdown */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">Ordered Products</Text>
        {o.items.map((item) => (
          <View key={item.id} className="flex-row items-center justify-between bg-surface rounded-xl border border-line p-2.5">
            <View className="flex-1 mr-2">
              <Text className="text-xs font-bold text-ink">{item.productName}</Text>
              <Text className="text-[10px] text-muted mt-0.5">Qty: {item.qty} @ {inr(item.price)}</Text>
            </View>
            <Text className="text-xs font-black text-brand">{inr(item.lineTotal)}</Text>
          </View>
        ))}
      </View>

      {/* Progress Timeline */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">Fulfillment Timeline</Text>
        {TIMELINE_STATUSES.map((stepStatus, i) => {
          const done = i <= currentIdx;
          const current = i === currentIdx;
          const historyEntry = o.statusHistory.find((h) => h.status === stepStatus);

          return (
            <View key={stepStatus} className="flex-row items-start gap-3">
              <View className="items-center">
                <View
                  className={`w-5 h-5 rounded-full items-center justify-center border ${
                    done ? 'bg-brand border-brand' : current ? 'bg-amber border-amber' : 'bg-surface border-line'
                  }`}
                >
                  <Text className={`text-[10px] font-black ${done || current ? 'text-white' : 'text-muted'}`}>
                    {done ? '✓' : i + 1}
                  </Text>
                </View>
                {i < TIMELINE_STATUSES.length - 1 ? (
                  <View className={`w-0.5 h-6 ${done ? 'bg-brand' : 'bg-line'}`} />
                ) : null}
              </View>
              <View className="flex-1 pb-2">
                <Text className={`text-xs font-black ${done ? 'text-ink' : current ? 'text-amber' : 'text-muted'}`}>
                  {STATUS_LABELS[stepStatus] || stepStatus}
                </Text>
                {historyEntry ? (
                  <Text className="text-[10px] text-muted font-medium mt-0.5">
                    {shortDate(historyEntry.at.slice(0, 10))} {historyEntry.note ? `· ${historyEntry.note}` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Next Step Action */}
      {nextStep && o.status !== 'Cancelled' ? (
        <View className="gap-2 border-t border-line pt-3">
          {needsPartner ? (
            <Field label="Assign Delivery Partner">
              <Input value={partner} onChangeText={setPartner} placeholder="e.g. BlueDart, VRL Logistics…" />
            </Field>
          ) : null}
          <Pressable
            onPress={handleAdvance}
            disabled={updateOrder.isPending}
            className="bg-brand py-3.5 rounded-xl items-center shadow-sm"
          >
            <Text className="text-white font-black text-xs">
              {updateOrder.isPending ? 'Updating…' : `Advance to: ${STATUS_LABELS[nextStep] || nextStep}`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Cancel Action */}
      {o.status !== 'Cancelled' && o.status !== 'CustomerReceiptConfirmed' ? (
        <View className="border-t border-line pt-3">
          {cancelling ? (
            <View className="gap-2">
              <Field label="Cancellation Reason">
                <Input value={reason} onChangeText={setReason} placeholder="Reason for cancellation…" />
              </Field>
              <View className="flex-row gap-2">
                <Pressable onPress={() => setCancelling(false)} className="flex-1 py-2.5 rounded-xl border border-line items-center">
                  <Text className="text-xs font-bold text-muted">Keep Order</Text>
                </Pressable>
                <Pressable
                  onPress={handleCancel}
                  disabled={updateOrder.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-danger items-center"
                >
                  <Text className="text-white font-black text-xs">
                    {updateOrder.isPending ? 'Cancelling…' : 'Confirm Cancel'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setCancelling(true)} className="self-center py-2">
              <Text className="text-danger font-bold text-xs">Cancel Order</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Report({ orders }: { orders: OrderRow[] }) {
  const total = orders.reduce((s, o) => s + o.total, 0);
  const completed = orders.filter((o) => o.status === 'CustomerReceiptConfirmed');
  const delivered = orders.filter((o) => ['DeliveredFromWarehouse', 'DeliveredToCustomer', 'CustomerReceiptConfirmed'].includes(o.status));

  return (
    <ScrollView className="flex-1 px-4 pb-28" contentContainerClassName="gap-3 py-3">
      <View className="flex-row flex-wrap gap-2.5">
        <Kpi label="Total SO Value" value={lakhs(total)} hint={`${orders.length} orders`} />
        <Kpi label="Delivered" value={String(delivered.length)} accent hint={`${completed.length} receipt confirmed`} />
      </View>

      <Card>
        <Text className="text-[14px] font-black text-ink mb-2">Fulfillment by Status</Text>
        <View className="gap-2">
          {ORDER_STATUS_VALUES.map((st) => {
            const count = orders.filter((o) => o.status === st).length;
            return (
              <View key={st} className="flex-row items-center justify-between py-2 border-b border-line/80">
                <Text className="text-xs font-bold text-ink">{STATUS_LABELS[st] || st}</Text>
                <View className="bg-surface3 px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-black text-ink2">{count}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="w-1/2 gap-0.5">
      <Text className="text-[10px] text-muted font-extrabold uppercase">{label}</Text>
      <Text className={`text-[13px] ${strong ? 'text-brand font-black' : 'text-ink font-bold'}`}>{value}</Text>
    </View>
  );
}
