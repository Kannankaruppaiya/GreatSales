import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Chip, Progress, Empty, KpiStrip, MonthBar } from '@/gs/kit';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { C } from '@/gs/theme';
import { RemarksPanel } from '@/gs/RemarksPanel';
import { useAuthUser } from '@/gs/auth';
import { useProjections, useUpdateProjection, type ProjectionLine } from '@/gs/queries/projections';
import { useCustomers } from '@/gs/queries/customers';
import { useCreateMapping, usePrincipals, useProducts } from '@/gs/queries/catalog';
import { ApiError } from '@/gs/api';
import { useCreateFollowUp } from '@/gs/queries/followups';
import { useCreateOrder } from '@/gs/queries/orders';
import {
  inr, lakhs, pct, shortDate, projTone, probTone, PROJ_STATUSES, FU_MODES, DELIVERY_MODES,
} from '@/gs/domain';
import type { ProjStatusValue } from '@greatsales/shared';
import { SearchIcon } from '@/gs/icons';

const NOW = new Date();

function exportCsv(rows: ProjectionLine[]) {
  const head = ['Customer', 'Principal', 'Product', 'Rate', 'ProjQty', 'ProjValue', 'AchQty', 'AchValue', 'Conf%', 'Status', 'NextFollowUp'];
  const body = rows.map((p) => [
    p.customerName, p.principalName, p.productName, p.price, p.committedQty, p.projValue,
    p.achievedQty, p.achValue, p.probability ?? '', p.status, p.nextFollowUp || '',
  ]);
  const csv = [head, ...body].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  Share.share({ message: csv, title: 'projections.csv' }).catch(() => {});
}

type FilterKey = 'all' | 'projected' | 'unprojected' | 'followup';

export default function Projections() {
  const user = useAuthUser();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [principalFilter, setPrincipalFilter] = useState<string>('ALL');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [year, setYear] = useState(NOW.getFullYear());
  const [month, setMonth] = useState(NOW.getMonth() + 1);

  const period = `${year}-${String(month).padStart(2, '0')}`;
  const { data, isLoading, refetch } = useProjections({ period });
  const projections = data?.lines ?? [];
  const summary = data?.summary;

  const { items: customers } = useCustomers();
  const { data: principals = [] } = usePrincipals();

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const counts = useMemo(() => ({
    all: projections.length,
    projected: projections.filter((p) => p.achievedQty > 0).length,
    unprojected: projections.filter((p) => p.achievedQty === 0).length,
    followup: projections.filter((p) => !!p.nextFollowUp).length,
  }), [projections]);

  const rows = useMemo(() => projections.filter((p) => {
    if (principalFilter !== 'ALL' && p.principalName !== principalFilter) return false;
    if (q && !p.customerName.toLowerCase().includes(q.toLowerCase()) && !p.productName.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'projected') return p.achievedQty > 0;
    if (filter === 'unprojected') return p.achievedQty === 0;
    if (filter === 'followup') return !!p.nextFollowUp;
    return true;
  }), [projections, filter, principalFilter, q]);

  const open = projections.find((p) => p.id === openId) || null;
  const totalCommitted = summary?.totCommitted ?? projections.reduce((s, p) => s + p.projValue, 0);
  const totalAchieved = summary?.totAchieved ?? projections.reduce((s, p) => s + p.achValue, 0);
  const totPct = summary?.totPct ?? (totalCommitted ? (totalAchieved / totalCommitted) * 100 : 0);
  const needsFU = projections.filter((p) => !!p.nextFollowUp).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Sticky Zones 1-3 */}
      <View className="bg-canvas border-b border-line/50 px-4 pt-2 pb-0 gap-1">
        {/* Zone 1 */}
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Text className="text-[20px] font-black text-ink tracking-tight">Recurring Projections</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable onPress={() => exportCsv(rows)} className="px-3 py-2 rounded-xl border border-line bg-surface">
              <Text className="text-[11px] font-extrabold text-muted">Export CSV</Text>
            </Pressable>
            <Pressable onPress={() => setShowMapModal(true)} className="bg-brand px-3 py-2 rounded-xl shadow-sm">
              <Text className="text-white font-black text-xs">+ Map</Text>
            </Pressable>
          </View>
        </View>
        {/* Zone 2 — MonthBar + KPI Strip */}
        <MonthBar year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />
        <View className="mb-1.5">
          <KpiStrip items={[
            { label: 'Committed', value: lakhs(totalCommitted) },
            { label: 'Achieved', value: lakhs(totalAchieved), accent: totalAchieved > 0 },
            { label: 'Achievement', value: pct(totPct, 0), accent: totalAchieved >= totalCommitted * 0.8 },
            { label: 'Needs FU', value: String(needsFU), alert: needsFU > 0 },
          ]} />
        </View>
        {/* Zone 3 — Brand + Status Filter */}
        <View className="gap-2 pb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            {/* The tenant's own brands. This used to be a hardcoded list of
                five oil companies shown to every tenant regardless of who they
                actually sell for. */}
            <Chip key="ALL" label="All Brands" active={principalFilter === 'ALL'} onPress={() => setPrincipalFilter('ALL')} />
            {principals.map((pr) => (
              <Chip key={pr.id} label={pr.name} active={principalFilter === pr.name} onPress={() => setPrincipalFilter(pr.name)} />
            ))}
          </ScrollView>
          <View className="flex-row items-center bg-surface border border-line rounded-xl px-3 py-2.5">
            <SearchIcon size={16} color="#64748b" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search customer or product…"
              placeholderTextColor={C.faint}
              className="flex-1 ml-2 text-[13px] text-ink font-medium"
              autoCapitalize="none"
            />
            {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Text className="text-muted font-bold text-sm">✕</Text></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            {([['all', 'All'], ['projected', 'Projected'], ['unprojected', 'Unprojected'], ['followup', 'Needs FU']] as [FilterKey, string][]).map(([k, l]) => (
              <Chip key={k} label={l} count={counts[k]} active={filter === k} onPress={() => setFilter(k)} />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Zone 4 — List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={C.brand} />
          <Text className="text-xs text-muted font-medium mt-3">Loading projections…</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          contentContainerClassName="p-4 pb-28 gap-2.5"
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => <Line p={item} onPress={() => setOpenId(item.id)} />}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={<Empty text="No projection lines match the criteria." />}
        />
      )}

      {/* Line Detail Modal */}
      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.customerName || ''}
        subtitle={open ? `${open.principalName} · ${open.productName}` : ''}
        footer={<ModalBtn label="Close" variant="ghost" onPress={() => setOpenId(null)} />}
      >
        {open ? (
          <View className="gap-5">
            <LineDetail p={open} onClose={() => setOpenId(null)} />
            <RemarksPanel entityType="Projection" entityId={open.id} />
          </View>
        ) : null}
      </Sheet>

      {/* Map Product Modal */}
      <Sheet
        open={showMapModal}
        onClose={() => setShowMapModal(false)}
        title="Map product to customer"
        subtitle="Add a new recurring product line for forecasting"
      >
        <MapProductForm
          customers={customers.map(c => ({ id: c.id, name: c.name }))}
          onDone={() => {
            setShowMapModal(false);
            refetch();
          }}
        />
      </Sheet>
    </SafeAreaView>
  );
}

function Line({ p, onPress }: { p: ProjectionLine; onPress: () => void }) {
  const prob = p.probability ?? 50;
  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-[14px] font-black text-ink">{p.customerName}</Text>
          <Text className="text-[11px] text-muted font-medium mt-0.5">
            {p.principalName} · <Text className="text-ink2 font-semibold">{p.productName}</Text>
          </Text>
        </View>
        <Badge label={p.status} tone={projTone(p.status)} small showDot />
      </View>

      {/* Metrics Row */}
      <View className="flex-row items-center bg-surface3/60 rounded-xl p-2.5 my-2.5">
        <Cell label="Proj Qty" value={String(p.committedQty)} />
        <Cell label="Achieved" value={String(p.achievedQty)} />
        <Cell label="Rate" value={inr(p.price)} />
        <Cell label="Total Value" value={inr(p.projValue)} strong />
      </View>

      {/* Confidence Meter & Follow-up */}
      <View className="flex-row justify-between items-center mb-1.5">
        <Text className="text-[11px] font-bold text-ink2">
          Confidence {prob}%
        </Text>
        <Text className="text-[11px] text-muted font-semibold">
          Follow-up: <Text className="text-ink">{p.nextFollowUp ? shortDate(p.nextFollowUp) : 'None'}</Text>
        </Text>
      </View>
      <Progress value={prob} tone={probTone(prob)} height={5} />
    </Card>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-1">
      <Text className="text-[10px] text-muted font-extrabold uppercase">{label}</Text>
      <Text className={`text-[13px] mt-0.5 ${strong ? 'text-brand font-black' : 'text-ink font-bold'}`}>{value}</Text>
    </View>
  );
}

function LineDetail({ p, onClose }: { p: ProjectionLine; onClose: () => void }) {
  const updateProjection = useUpdateProjection();
  const createFollowUp = useCreateFollowUp();
  const createOrder = useCreateOrder();
  const user = useAuthUser();

  const [projQty, setProjQty] = useState(String(p.committedQty));
  const [achQty, setAchQty] = useState(String(p.achievedQty));
  const [price, setPrice] = useState(String(p.price));
  const [expClose, setExpClose] = useState(p.targetDate || '');
  const [mode, setMode] = useState<string>('Call');
  const [prob, setProb] = useState(String(p.probability ?? 50));
  const [notes, setNotes] = useState('');
  const [next, setNext] = useState(p.nextFollowUp || '');
  const [orderCreatedMsg, setOrderCreatedMsg] = useState('');

  const handleSaveRateAndDate = () => {
    updateProjection.mutate({
      id: p.id,
      patch: {
        price: +price || p.price,
        targetDate: expClose || null,
      },
    });
  };

  const handleSaveQuantities = () => {
    updateProjection.mutate({
      id: p.id,
      patch: {
        committedQty: +projQty || 0,
        achievedQty: +achQty || 0,
      },
    });
  };

  const handleStatusChange = (s: string) => {
    updateProjection.mutate({
      id: p.id,
      patch: { status: s as ProjStatusValue },
    });
  };

  const handleSaveFollowUp = () => {
    if (!notes.trim()) return;
    const parsedProb = prob === '' ? null : +prob;
    updateProjection.mutate({
      id: p.id,
      patch: {
        probability: parsedProb,
        nextFollowUp: next || null,
      },
    });
    createFollowUp.mutate({
      entityType: 'Projection',
      entityId: p.id,
      dueDate: next || new Date().toISOString().slice(0, 10),
      salespersonId: user?.userId,
      title: `${p.customerName} - ${p.productName}`,
      subtitle: `${mode} · Prob: ${prob}%`,
      amount: p.projValue,
      note: notes.trim(),
    });
    setNotes('');
  };

  const handleCreateOrder = () => {
    const qty = (+achQty || +projQty || 1);
    const unitPrice = +price || p.price;
    const orderCode = `SO-${Date.now().toString().slice(-6)}`;
    createOrder.mutate({
      code: orderCode,
      customerId: p.customerId,
      salespersonId: user?.userId || p.salespersonId,
      items: [{
        productId: p.productId,
        qty,
        price: unitPrice,
      }],
      status: 'Created',
      deliveryMode: 'TransportLR',
      deliveryAddress: p.customerName,
    }, {
      onSuccess: () => {
        setOrderCreatedMsg(`Order ${orderCode} created successfully!`);
        setTimeout(() => {
          onClose();
          router.push('/(app)/orders');
        }, 800);
      },
    });
  };

  return (
    <View className="gap-4">
      {/* Line details */}
      <View className="p-3 bg-surface2/60 rounded-xl border border-line/60">
        <Text className="text-xs text-muted font-bold">Principal: <Text className="text-ink font-semibold">{p.principalName}</Text></Text>
        <Text className="text-xs text-muted font-bold mt-1">Product: <Text className="text-ink font-semibold">{p.productName}</Text></Text>
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field label="Rate ₹">
            <Input value={price} onChangeText={setPrice} keyboardType="numeric" />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="Expected closure date">
            <Input value={expClose} onChangeText={setExpClose} placeholder="YYYY-MM-DD" />
          </Field>
        </View>
      </View>
      <Pressable
        onPress={handleSaveRateAndDate}
        disabled={updateProjection.isPending}
        className="self-start bg-brand-soft px-4 py-2 rounded-xl"
      >
        <Text className="text-brand-dark font-black text-xs">
          {updateProjection.isPending ? 'Saving…' : 'Save Rate & Date'}
        </Text>
      </Pressable>

      {/* Edit quantities + status */}
      <View className="flex-row gap-2 border-t border-line pt-3">
        <View className="flex-1"><Field label="Projected Qty"><Input value={projQty} onChangeText={setProjQty} keyboardType="numeric" /></Field></View>
        <View className="flex-1"><Field label="Achieved Qty"><Input value={achQty} onChangeText={setAchQty} keyboardType="numeric" /></Field></View>
      </View>
      <Pressable
        onPress={handleSaveQuantities}
        disabled={updateProjection.isPending}
        className="self-start bg-brand-soft px-4 py-2 rounded-xl"
      >
        <Text className="text-brand-dark font-black text-xs">
          {updateProjection.isPending ? 'Saving…' : 'Save Quantities'}
        </Text>
      </Pressable>

      <Field label="Projection Pipeline Status">
        <Pills options={PROJ_STATUSES} value={p.status} onChange={handleStatusChange} />
      </Field>

      {/* Follow-up log */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">
          Log Follow-up
        </Text>
        <Field label="Contact Mode"><Pills options={FU_MODES} value={mode} onChange={setMode} /></Field>
        <View className="flex-row gap-2">
          <View className="flex-1"><Field label="Probability %"><Input value={prob} onChangeText={setProb} keyboardType="numeric" /></Field></View>
          <View className="flex-1"><Field label="Next Date"><Input value={next} onChangeText={setNext} placeholder="YYYY-MM-DD" /></Field></View>
        </View>
        <Field label="Discussion Notes"><Input value={notes} onChangeText={setNotes} placeholder="Key discussion points…" multiline /></Field>
        <Pressable
          onPress={handleSaveFollowUp}
          disabled={createFollowUp.isPending}
          className="self-start bg-brand px-4 py-2.5 rounded-xl"
        >
          <Text className="text-white font-black text-xs">
            {createFollowUp.isPending ? 'Saving…' : 'Save Follow-up'}
          </Text>
        </Pressable>
      </View>

      {orderCreatedMsg ? (
        <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <Text className="text-xs text-emerald-800 font-bold">{orderCreatedMsg}</Text>
        </View>
      ) : null}

      {/* Create Sales Order */}
      {['Confirmed', 'Partially Confirmed', 'PO Received', 'Order Placed'].includes(p.status) ? (
        <View className="border-t border-line pt-3">
          <Pressable
            onPress={handleCreateOrder}
            disabled={createOrder.isPending}
            className="bg-ink px-4 py-3.5 rounded-xl items-center shadow-sm"
          >
            <Text className="text-white font-black text-xs">
              {createOrder.isPending ? 'Creating Order…' : '+ Create Sales Order'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Map a product to a customer, so it appears on next month's worksheet.
 *
 * This form used to collect a customer, a hardcoded brand name, a TYPED SKU
 * string and a price, and then call `onDone()` — the submit body was the
 * comment "Mapping product done". Nothing was sent, and nothing could have
 * been: `MappingCreate` needs a real `productId`, and a typed product name has
 * no id behind it.
 *
 * So the picker is now the fix as much as the request is. Principal and product
 * both come from the catalog, and "Add Mapping" is disabled until a real
 * product is selected — a mapping to a SKU that does not exist is not a thing
 * the server can store, and pretending otherwise is what produced the silent
 * failure in the first place.
 */
function MapProductForm({ customers, onDone }: { customers: { id: string; name: string }[]; onDone: () => void }) {
  const [selectedCust, setSelectedCust] = useState(customers[0]?.id || '');
  const [principalId, setPrincipalId] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [price, setPrice] = useState('');
  const [err, setErr] = useState('');

  const { data: principals = [] } = usePrincipals();
  const { items: products } = useProducts(
    { principalId: principalId || undefined },
    { enabled: !!principalId, autoFetchAll: true },
  );
  const createMapping = useCreateMapping();

  const submit = async () => {
    setErr('');
    if (!selectedCust || !productId) {
      setErr('Select a customer and a product from the catalog.');
      return;
    }
    const parsedPrice = price.trim() === '' ? null : Number(price);
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setErr('Agreed rate must be a positive number.');
      return;
    }
    try {
      await createMapping.mutateAsync({
        customerId: selectedCust,
        productId,
        customPrice: parsedPrice,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save the mapping.');
    }
  };

  return (
    <View className="gap-3">
      <Field label="Customer Account">
        <ScrollView style={{ maxHeight: 150 }} className="border border-line rounded-xl p-1 bg-surface">
          {customers.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setSelectedCust(item.id)}
              className={`px-3 py-2 rounded-lg ${selectedCust === item.id ? 'bg-brand' : ''}`}
            >
              <Text className={`text-xs font-black ${selectedCust === item.id ? 'text-white' : 'text-ink'}`}>
                {item.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Field>

      <Field label="Principal Brand">
        <Pills
          options={principals.map((p) => p.name)}
          value={principals.find((p) => p.id === principalId)?.name ?? ''}
          onChange={(name) => {
            setPrincipalId(principals.find((p) => p.name === name)?.id ?? '');
            // The old product belongs to the old brand.
            setProductId('');
          }}
        />
      </Field>

      <Field label="Product / SKU">
        {!principalId ? (
          <Text className="text-xs text-muted font-medium px-1 py-2">
            Pick a principal first.
          </Text>
        ) : products.length === 0 ? (
          <Text className="text-xs text-muted font-medium px-1 py-2">
            No products in the catalog for this brand.
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 150 }} className="border border-line rounded-xl p-1 bg-surface">
            {products.map((pr) => (
              <Pressable
                key={pr.id}
                onPress={() => setProductId(pr.id)}
                className={`px-3 py-2 rounded-lg ${productId === pr.id ? 'bg-brand' : ''}`}
              >
                <Text className={`text-xs font-black ${productId === pr.id ? 'text-white' : 'text-ink'}`}>
                  {pr.name}
                  {pr.sku ? ` · ${pr.sku}` : ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Field>

      <Field label="Agreed Selling Rate ₹ (optional)">
        <Input value={price} onChangeText={setPrice} placeholder="e.g. 185" keyboardType="numeric" />
      </Field>

      {err ? <Text className="text-xs text-danger font-bold">{err}</Text> : null}

      <View className="flex-row gap-2 mt-2">
        <ModalBtn label="Cancel" variant="ghost" onPress={onDone} />
        <ModalBtn
          label={createMapping.isPending ? 'Saving…' : 'Add Mapping'}
          disabled={!selectedCust || !productId || createMapping.isPending}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}

