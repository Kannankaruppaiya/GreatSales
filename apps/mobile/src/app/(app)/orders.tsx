import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Chip, Empty, Kpi, KpiStrip } from '@/gs/kit';
import { Sheet, Field, Input, ModalBtn } from '@/gs/modal';
import { C } from '@/gs/theme';
import { useStore, actions, OrderX, SO_FLOW } from '@/gs/store';
import { inr, lakhs, shortDate, soTone, fmtDur, SO_STATUSES } from '@/gs/domain';
import { SearchIcon, ChartIcon, CheckCircleIcon } from '@/gs/icons';

export default function Orders() {
  const orders = useStore((s) => s.orders);
  const [tab, setTab] = useState<'list' | 'report'>('list');
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<string>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => orders.filter((o) => {
    if (chip !== 'ALL' && o.status !== chip) return false;
    if (q && !o.code.toLowerCase().includes(q.toLowerCase()) && !o.customerName.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [orders, chip, q]);

  const open = orders.find((o) => o.id === openId) || null;
  const totalValue = orders.reduce((s, o) => s + o.value, 0);
  const inTransit = orders.filter((o) => !['Customer Receipt Confirmed', 'Created'].includes(o.status)).length;
  const urgent = orders.filter((o) => o.isUrgent).length;
  const completed = orders.filter((o) => o.status === 'Customer Receipt Confirmed').length;

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
            <TextInput value={q} onChangeText={setQ} placeholder="Search SO code or customer…" placeholderTextColor={C.faint}
              className="flex-1 ml-2 text-[13px] text-ink font-medium" autoCapitalize="none" />
            {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Text className="text-muted font-bold text-sm">x</Text></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            <Chip key="ALL" label="All Orders" count={orders.length} active={chip === 'ALL'} onPress={() => setChip('ALL')} />
            {SO_STATUSES.map((s) => (
              <Chip key={s} label={s} count={orders.filter((o) => o.status === s).length} active={chip === s} onPress={() => setChip(s)} />
            ))}
          </ScrollView>
        </View>
      </View>

      {tab === 'report' ? (
        <Report orders={orders} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(o) => o.id}
          contentContainerClassName="p-4 pb-28 gap-2.5"
          showsVerticalScrollIndicator={false}
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
        subtitle={open ? `${open.customerName} · ${inr(open.value)}` : ''}
        footer={<ModalBtn label="Close" variant="ghost" onPress={() => setOpenId(null)} />}
      >
        {open ? <OrderDetail o={open} /> : null}
      </Sheet>
    </SafeAreaView>
  );
}

function OrderCard({ o, onPress }: { o: OrderX; onPress: () => void }) {
  const idx = SO_FLOW.indexOf(o.status);
  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-[14px] font-black text-ink">{o.code}</Text>
            {o.isUrgent ? <Badge label="Urgent" tone="lost" small /> : null}
          </View>
          <Text className="text-xs text-muted font-medium mt-0.5">{o.customerName}</Text>
          <Text className="text-[11px] text-ink2 font-semibold mt-0.5">{o.productName}</Text>
        </View>
        <Text className="text-[15px] font-black text-brand">{inr(o.value)}</Text>
      </View>

      {/* Mini 6-step progress dots */}
      <View className="flex-row items-center gap-1 mt-2.5">
        {SO_FLOW.map((_, i) => (
          <View key={i} className={`flex-1 h-1.5 rounded-full ${
            i < idx ? 'bg-brand' : i === idx ? 'bg-amber' : 'bg-surface3'
          }`} />
        ))}
        <Text className="text-[10px] text-muted font-bold ml-1">{idx + 1}/{SO_FLOW.length}</Text>
      </View>

      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-line/80 gap-2">
        <Badge label={o.status} tone={soTone(o.status)} small showDot />
        <Text className="text-[11px] text-muted font-semibold">
          {o.deliveryMode} · ETA {shortDate(o.expectedDelivery)}
        </Text>
      </View>
    </Card>
  );
}

function OrderDetail({ o }: { o: OrderX }) {
  const [partner, setPartner] = useState('');
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const idx = SO_FLOW.indexOf(o.status);
  const nextStep = idx >= 0 && idx < SO_FLOW.length - 1 ? SO_FLOW[idx + 1] : null;
  const needsPartner = o.status === 'Acknowledged';

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-y-3 bg-surface3/60 rounded-xl p-3">
        <Info label="Order Status" value={o.status} />
        <Info label="Total Value" value={inr(o.value)} strong />
        <Info label="Product" value={o.productName ?? '—'} />
        <Info label="Delivery Mode" value={o.deliveryMode} />
        <Info label="Ship to" value={o.shipTo} />
        <Info label="Expected Delivery" value={shortDate(o.expectedDelivery)} />
      </View>

      {/* Progress Timeline */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">Fulfillment Timeline</Text>
        {o.timeline.map((step, i) => {
          const done = !!step.at;
          const current = i === idx;
          return (
            <View key={i} className="flex-row items-start gap-3">
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
                {i < o.timeline.length - 1 ? (
                  <View className={`w-0.5 h-6 ${done ? 'bg-brand' : 'bg-line'}`} />
                ) : null}
              </View>
              <View className="flex-1 pb-2">
                <Text className={`text-xs font-black ${done ? 'text-ink' : current ? 'text-amber' : 'text-muted'}`}>
                  {step.label}
                </Text>
                {step.at ? (
                  <Text className="text-[10px] text-muted font-medium mt-0.5">
                    {shortDate(step.at.slice(0, 10))} · {step.by || 'Ops'}
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
            onPress={() => actions.advanceOrder(o.id, { partner: partner.trim() || undefined })}
            className="bg-brand py-3.5 rounded-xl items-center shadow-sm"
          >
            <Text className="text-white font-black text-xs">Advance to: {nextStep}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Cancel Action */}
      {o.status !== 'Cancelled' && o.status !== 'Customer Receipt Confirmed' ? (
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
                  onPress={() => { if (reason.trim()) actions.cancelOrder(o.id, reason.trim()); }}
                  className="flex-1 py-2.5 rounded-xl bg-danger items-center"
                >
                  <Text className="text-white font-black text-xs">Confirm Cancel</Text>
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

function Report({ orders }: { orders: OrderX[] }) {
  const total = orders.reduce((s, o) => s + o.value, 0);
  const completed = orders.filter((o) => o.status === 'Customer Receipt Confirmed');
  const delivered = orders.filter((o) => ['Delivered from Warehouse', 'Delivered to Customer', 'Customer Receipt Confirmed'].includes(o.status));

  return (
    <ScrollView className="flex-1 px-4 pb-28" contentContainerClassName="gap-3 py-3">
      <View className="flex-row flex-wrap gap-2.5">
        <Kpi label="Total SO Value" value={lakhs(total)} hint={`${orders.length} orders`} />
        <Kpi label="Delivered" value={String(delivered.length)} accent hint={`${completed.length} receipt confirmed`} />
      </View>

      <Card>
        <Text className="text-[14px] font-black text-ink mb-2">Fulfillment by Status</Text>
        <View className="gap-2">
          {SO_STATUSES.map((st) => {
            const count = orders.filter((o) => o.status === st).length;
            return (
              <View key={st} className="flex-row items-center justify-between py-2 border-b border-line/80">
                <Text className="text-xs font-bold text-ink">{st}</Text>
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
