import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Chip, Progress, Empty, KpiStrip, MonthBar } from '@/gs/kit';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { C } from '@/gs/theme';
import { useStore, actions, ProjectionX } from '@/gs/store';
import {
  inr, lakhs, pct, shortDate, projTone, probTone, PROJ_STATUSES, FU_MODES, DELIVERY_MODES, PRINCIPALS,
} from '@/gs/domain';
import { SearchIcon, ChartIcon } from '@/gs/icons';

const NOW = new Date();

function exportCsv(rows: ProjectionX[]) {
  const head = ['Customer', 'Principal', 'Product', 'Rate', 'ProjQty', 'ProjValue', 'AchQty', 'AchValue', 'Conf%', 'Status', 'NextFollowUp'];
  const body = rows.map((p) => [
    p.customerName, p.principal, p.product, p.price, p.projectedQty, p.projectedQty * p.price,
    p.achievedQty, p.achievedQty * p.price, p.probability, p.status, p.nextFollowUp || '',
  ]);
  const csv = [head, ...body].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  Share.share({ message: csv, title: 'projections.csv' }).catch(() => {});
}

type FilterKey = 'all' | 'projected' | 'unprojected' | 'followup';

export default function Projections() {
  const projections = useStore((s) => s.projections);
  const customers = useStore((s) => s.customers);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [principalFilter, setPrincipalFilter] = useState<string>('ALL');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [year, setYear] = useState(NOW.getFullYear());
  const [month, setMonth] = useState(NOW.getMonth() + 1);
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const counts = useMemo(() => ({
    all: projections.length,
    projected: projections.filter((p) => p.achievedQty > 0).length,
    unprojected: projections.filter((p) => p.achievedQty === 0).length,
    followup: projections.filter((p) => !!p.nextFollowUp).length,
  }), [projections]);

  const rows = useMemo(() => projections.filter((p) => {
    if (principalFilter !== 'ALL' && p.principal !== principalFilter) return false;
    if (q && !p.customerName.toLowerCase().includes(q.toLowerCase()) && !p.product.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'projected') return p.achievedQty > 0;
    if (filter === 'unprojected') return p.achievedQty === 0;
    if (filter === 'followup') return !!p.nextFollowUp;
    return true;
  }), [projections, filter, principalFilter, q]);

  const committed = rows.reduce((s, p) => s + p.projectedQty * p.price, 0);
  const achieved = rows.reduce((s, p) => s + p.achievedQty * p.price, 0);
  const open = projections.find((p) => p.id === openId) || null;
  const totalCommitted = projections.reduce((s, p) => s + p.projectedQty * p.price, 0);
  const totalAchieved = projections.reduce((s, p) => s + p.achievedQty * p.price, 0);
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
            { label: 'Achievement', value: pct(totalCommitted ? (totalAchieved / totalCommitted) * 100 : 0, 0), accent: totalAchieved >= totalCommitted * 0.8 },
            { label: 'Needs FU', value: String(needsFU), alert: needsFU > 0 },
          ]} />
        </View>
        {/* Zone 3 — Brand + Status Filter */}
        <View className="gap-2 pb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            <Chip key="ALL" label="All Brands" active={principalFilter === 'ALL'} onPress={() => setPrincipalFilter('ALL')} />
            {PRINCIPALS.map((pr) => (
              <Chip key={pr} label={pr} active={principalFilter === pr} onPress={() => setPrincipalFilter(pr)} />
            ))}
          </ScrollView>
          <View className="flex-row items-center bg-surface border border-line rounded-xl px-3 py-2.5">
            <SearchIcon size={16} color="#64748b" />
            <TextInput value={q} onChangeText={setQ} placeholder="Search customer or product…" placeholderTextColor={C.faint}
              className="flex-1 ml-2 text-[13px] text-ink font-medium" autoCapitalize="none" />
            {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Text className="text-muted font-bold text-sm">x</Text></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            {([['all', 'All'], ['projected', 'Projected'], ['unprojected', 'Unprojected'], ['followup', 'Needs FU']] as [FilterKey, string][]).map(([k, l]) => (
              <Chip key={k} label={l} count={counts[k]} active={filter === k} onPress={() => setFilter(k)} />
            ))}
          </ScrollView>
        </View>
      </View>
      {/* Zone 4 — List */}
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerClassName="p-4 pb-28 gap-2.5"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <Line p={item} onPress={() => setOpenId(item.id)} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={<Empty text="No projection lines match the criteria." />}
      />

      {/* Line Detail Modal */}
      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.customerName || ''}
        subtitle={open ? `${open.principal} · ${open.product}` : ''}
        footer={<ModalBtn label="Close" variant="ghost" onPress={() => setOpenId(null)} />}
      >
        {open ? <LineDetail p={open} onClose={() => setOpenId(null)} /> : null}
      </Sheet>

      {/* Map Product Modal */}
      <Sheet
        open={showMapModal}
        onClose={() => setShowMapModal(false)}
        title="Map product to customer"
        subtitle="Add a new recurring product line for forecasting"
      >
        <MapProductForm customers={customers} onDone={() => setShowMapModal(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

function Line({ p, onPress }: { p: ProjectionX; onPress: () => void }) {
  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-[14px] font-black text-ink">{p.customerName}</Text>
          <Text className="text-[11px] text-muted font-medium mt-0.5">
            {p.principal} · <Text className="text-ink2 font-semibold">{p.product}</Text>
          </Text>
        </View>
        <Badge label={p.status} tone={projTone(p.status)} small showDot />
      </View>

      {/* Metrics Row */}
      <View className="flex-row items-center bg-surface3/60 rounded-xl p-2.5 my-2.5">
        <Cell label="Proj Qty" value={String(p.projectedQty)} />
        <Cell label="Achieved" value={String(p.achievedQty)} />
        <Cell label="Rate" value={inr(p.price)} />
        <Cell label="Total Value" value={inr(p.projectedQty * p.price)} strong />
      </View>

      {/* Confidence Meter & Follow-up */}
      <View className="flex-row justify-between items-center mb-1.5">
        <Text className="text-[11px] font-bold text-ink2">
          Confidence {p.probability}%
          {p.fus.length ? ` · ${p.fus.length} logs` : ''}
          {p.remarks.length ? ` · ${p.remarks.length} remarks` : ''}
        </Text>
        <Text className="text-[11px] text-muted font-semibold">
          Follow-up: <Text className="text-ink">{shortDate(p.nextFollowUp)}</Text>
        </Text>
      </View>
      <Progress value={p.probability} tone={probTone(p.probability)} height={5} />
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

function LineDetail({ p, onClose }: { p: ProjectionX; onClose: () => void }) {
  const [projQty, setProjQty] = useState(String(p.projectedQty));
  const [achQty, setAchQty] = useState(String(p.achievedQty));
  const [product, setProduct] = useState(p.product);
  const [price, setPrice] = useState(String(p.price));
  const [expClose, setExpClose] = useState(p.expClose || '');
  const [mode, setMode] = useState<string>('Call');
  const [prob, setProb] = useState(String(p.probability));
  const [notes, setNotes] = useState('');
  const [next, setNext] = useState('');
  const [remark, setRemark] = useState('');

  return (
    <View className="gap-4">
      {/* Line details */}
      <Field label="Principal Brand">
        <Pills options={PRINCIPALS} value={p.principal} onChange={(v) => actions.updateProjection(p.id, { principal: v })} />
      </Field>
      <View className="flex-row gap-2">
        <View className="flex-[2]"><Field label="Product / Sub-SKU"><Input value={product} onChangeText={setProduct} placeholder="Product name" /></Field></View>
        <View className="flex-1"><Field label="Rate ₹"><Input value={price} onChangeText={setPrice} keyboardType="numeric" /></Field></View>
      </View>
      <Field label="Expected closure date"><Input value={expClose} onChangeText={setExpClose} placeholder="YYYY-MM-DD" /></Field>
      <Pressable
        onPress={() => actions.updateProjection(p.id, { product: product.trim() || p.product, price: +price || p.price, expClose: expClose || null })}
        className="self-start bg-brand-soft px-4 py-2 rounded-xl"
      >
        <Text className="text-brand-dark font-black text-xs">Save Line Details</Text>
      </Pressable>

      {/* Edit quantities + status */}
      <View className="flex-row gap-2 border-t border-line pt-3">
        <View className="flex-1"><Field label="Projected Qty"><Input value={projQty} onChangeText={setProjQty} keyboardType="numeric" /></Field></View>
        <View className="flex-1"><Field label="Achieved Qty"><Input value={achQty} onChangeText={setAchQty} keyboardType="numeric" /></Field></View>
      </View>
      <Pressable
        onPress={() => actions.updateProjection(p.id, { projectedQty: +projQty || 0, achievedQty: +achQty || 0 })}
        className="self-start bg-brand-soft px-4 py-2 rounded-xl"
      >
        <Text className="text-brand-dark font-black text-xs">Save Quantities</Text>
      </Pressable>

      <Field label="Projection Pipeline Status">
        <Pills options={PROJ_STATUSES} value={p.status} onChange={(s) => actions.updateProjection(p.id, { status: s })} />
      </Field>

      {/* Follow-up log */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">
          Log Follow-up ({p.fus.length})
        </Text>
        {p.fus.slice(0, 3).map((f, i) => (
          <View key={i} className="bg-surface rounded-xl border border-line p-3">
            <Text className="text-[11px] text-muted font-bold">
              {f.date} · {f.mode}{f.prob != null ? ` · ${f.prob}%` : ''}{f.next ? ` · next ${f.next}` : ''}
            </Text>
            <Text className="text-xs text-ink font-medium mt-1">{f.notes}</Text>
          </View>
        ))}
        <Field label="Contact Mode"><Pills options={FU_MODES} value={mode} onChange={setMode} /></Field>
        <View className="flex-row gap-2">
          <View className="flex-1"><Field label="Probability %"><Input value={prob} onChangeText={setProb} keyboardType="numeric" /></Field></View>
          <View className="flex-1"><Field label="Next Date"><Input value={next} onChangeText={setNext} placeholder="YYYY-MM-DD" /></Field></View>
        </View>
        <Field label="Discussion Notes"><Input value={notes} onChangeText={setNotes} placeholder="Key discussion points…" multiline /></Field>
        <Pressable
          onPress={() => {
            if (!notes.trim()) return;
            actions.logProjectionFollowUp(p.id, { date: new Date().toISOString().slice(0, 10), mode, prob: prob === '' ? null : +prob, notes: notes.trim(), next: next || null });
            setNotes(''); setNext('');
          }}
          className="self-start bg-brand px-4 py-2.5 rounded-xl"
        >
          <Text className="text-white font-black text-xs">Save Follow-up</Text>
        </Pressable>
      </View>

      {/* Remarks */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">Remarks ({p.remarks.length})</Text>
        {p.remarks.slice(0, 3).map((r, i) => (
          <Text key={i} className="text-xs text-ink bg-surface border border-line rounded-xl p-3 font-medium">
            {r.text}
          </Text>
        ))}
        <Input value={remark} onChangeText={setRemark} placeholder="Add a remark…" multiline />
        <Pressable
          onPress={() => { if (remark.trim()) { actions.addProjectionRemark(p.id, remark.trim()); setRemark(''); } }}
          className="self-start bg-brand-soft px-4 py-2 rounded-xl"
        >
          <Text className="text-brand-dark font-black text-xs">Add Remark</Text>
        </Pressable>
      </View>

      {/* Create Sales Order */}
      {['Confirmed', 'Partially Confirmed', 'PO Received', 'Order Placed'].includes(p.status) ? (
        <View className="border-t border-line pt-3">
          <Pressable
            onPress={() => {
              actions.createOrder({
                customerName: p.customerName,
                productName: `${p.principal} - ${p.product}`,
                value: (p.achievedQty || p.projectedQty) * p.price,
                expectedDelivery: null,
                deliveryMode: DELIVERY_MODES[0],
                shipTo: p.customerName,
              });
              onClose();
              router.push('/(app)/orders');
            }}
            className="bg-ink px-4 py-3.5 rounded-xl items-center shadow-sm"
          >
            <Text className="text-white font-black text-xs">+ Create Sales Order</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function MapProductForm({ customers, onDone }: { customers: { id: string; name: string }[]; onDone: () => void }) {
  const [selectedCust, setSelectedCust] = useState(customers[0]?.id || '');
  const [principal, setPrincipal] = useState<string>(PRINCIPALS[0]);
  const [product, setProduct] = useState('');
  const [price, setPrice] = useState('');
  const [err, setErr] = useState('');

  const submit = () => {
    if (!selectedCust || !product.trim()) {
      setErr('Select customer and enter product name');
      return;
    }
    actions.addCustomerMapping(selectedCust, {
      principal,
      product: product.trim(),
      price: +price || 180,
    });
    onDone();
  };

  return (
    <View className="gap-3">
      <Field label="Customer Account">
        <View className="gap-1 border border-line rounded-xl p-1 bg-surface">
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
        </View>
      </Field>

      <Field label="Principal Brand">
        <Pills options={PRINCIPALS} value={principal} onChange={setPrincipal} />
      </Field>

      <Field label="Sub Product / SKU Name">
        <Input value={product} onChangeText={setProduct} placeholder="e.g. Tellus S2 MX 46" />
      </Field>

      <Field label="Agreed Selling Rate ₹">
        <Input value={price} onChangeText={setPrice} placeholder="e.g. 185" keyboardType="numeric" />
      </Field>

      {err ? <Text className="text-xs text-danger font-bold">{err}</Text> : null}

      <View className="flex-row gap-2 mt-2">
        <ModalBtn label="Cancel" variant="ghost" onPress={onDone} />
        <ModalBtn label="Add Mapping" onPress={submit} />
      </View>
    </View>
  );
}
