import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Chip, Empty, Kpi, Progress, KpiStrip, PageLayout } from '@/gs/kit';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { C } from '@/gs/theme';
import { useStore, actions, PaymentX } from '@/gs/store';
import {
  inr, lakhs, shortDate, agingDays, agingBucket, zoneTone, PAY_ZONES, type PayZone,
} from '@/gs/domain';
import { SearchIcon, WalletIcon } from '@/gs/icons';

export default function Payments() {
  const payments = useStore((s) => s.payments);
  const [tab, setTab] = useState<'list' | 'report'>('list');
  const [q, setQ] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Financial KPIs
  const totalPending = payments.reduce((s, p) => s + p.pending, 0);
  const redZoneVal = payments.filter((p) => p.zone === 'Red Zone').reduce((s, p) => s + p.pending, 0);
  const over90Val = payments.filter((p) => (agingDays(p.dueDate || p.date) ?? 0) > 90).reduce((s, p) => s + p.pending, 0);
  const fuDueCount = payments.filter((p) => {
    const d = agingDays(p.nextFollowUp);
    return d != null && d >= 0;
  }).length;

  const filtered = useMemo(() => payments.filter((p) => {
    if (zoneFilter !== 'ALL') {
      if (zoneFilter === 'Unassigned') {
        if (p.zone && p.zone !== 'Unassigned') return false;
      } else if (p.zone !== zoneFilter) {
        return false;
      }
    }
    if (q) {
      const matchName = p.customerName.toLowerCase().includes(q.toLowerCase());
      const matchRef = (p.refNo || '').toLowerCase().includes(q.toLowerCase());
      const matchInv = (p.invoiceNo || '').toLowerCase().includes(q.toLowerCase());
      if (!matchName && !matchRef && !matchInv) return false;
    }
    return true;
  }).sort((a, b) => (agingDays(b.dueDate || b.date) ?? 0) - (agingDays(a.dueDate || a.date) ?? 0)), [payments, q, zoneFilter]);

  const open = payments.find((p) => p.id === openId) || null;
  const oldestDays = filtered.length > 0 ? Math.max(...filtered.map((p) => agingDays(p.dueDate || p.date) ?? 0)) : 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Sticky Header Zones 1-3 */}
      <View className="bg-canvas border-b border-line/50 px-4 pt-2 pb-0 gap-1">
        {/* Zone 1 */}
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Pressable onPress={() => router.back()} hitSlop={12} className="flex-row items-center gap-0.5 mb-0.5">
              <Text className="text-brand font-black text-xs">‹ Dashboard</Text>
            </Pressable>
            <Text className="text-[20px] font-black text-ink tracking-tight">Payments Follow-up</Text>
          </View>
          <Pressable onPress={() => setShowAdd(true)} className="bg-brand px-3.5 py-2 rounded-xl shadow-sm">
            <Text className="text-white font-black text-xs">+ Invoice</Text>
          </Pressable>
        </View>
        {/* Zone 2 — KPI Strip */}
        <View className="mb-1.5">
          <KpiStrip items={[
            { label: 'Outstanding', value: lakhs(totalPending), alert: totalPending > 500000 },
            { label: 'Red Zone', value: lakhs(redZoneVal), alert: redZoneVal > 0 },
            { label: 'Over 90d', value: lakhs(over90Val), alert: over90Val > 0 },
            { label: 'FU Due', value: String(fuDueCount), accent: fuDueCount > 0 },
          ]} />
        </View>
        {/* Zone 3 — Tab + Zone Filter */}
        <View className="gap-2 pb-2">
          <View className="flex-row gap-2 p-1 bg-surface3 rounded-xl">
            <Pressable onPress={() => setTab('list')} className={`flex-1 py-1.5 rounded-lg items-center ${tab === 'list' ? 'bg-surface shadow-sm' : ''}`}>
              <Text className={`text-xs font-extrabold ${tab === 'list' ? 'text-ink' : 'text-muted'}`}>Invoices ({filtered.length})</Text>
            </Pressable>
            <Pressable onPress={() => setTab('report')} className={`flex-1 py-1.5 rounded-lg items-center ${tab === 'report' ? 'bg-surface shadow-sm' : ''}`}>
              <Text className={`text-xs font-extrabold ${tab === 'report' ? 'text-ink' : 'text-muted'}`}>Aging Report</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
            {['ALL', ...PAY_ZONES, 'Unassigned'].map((z) => (
              <Chip key={z} label={z === 'ALL' ? 'All Zones' : z} count={z === 'ALL' ? payments.length : payments.filter((p) => p.zone === z).length} active={zoneFilter === z} onPress={() => setZoneFilter(z)} />
            ))}
          </ScrollView>
        </View>
      </View>

      {tab === 'report' ? (
        <ScrollView className="flex-1 px-4 pb-28" contentContainerClassName="gap-3 py-3">
          <AgingReports payments={payments} />
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerClassName="p-4 pb-28 gap-2.5"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="gap-3 mb-1">
              {/* KPIs Grid */}
              <View className="flex-row flex-wrap gap-2.5">
                <Kpi
                  label="Total Pending"
                  value={lakhs(totalPending)}
                  hint={`${payments.length} invoices`}
                  icon={<WalletIcon size={14} color="#64748b" />}
                />
                <Kpi
                  label="Red Zone"
                  value={lakhs(redZoneVal)}
                  alert={redZoneVal > 0}
                  hint="Critical attention"
                />
                <Kpi
                  label="Overdue 90+d"
                  value={lakhs(over90Val)}
                  alert={over90Val > 0}
                  hint="High risk aging"
                />
                <Kpi
                  label="Follow-ups Due"
                  value={String(fuDueCount)}
                  hint={fuDueCount ? 'Call today' : 'All clear'}
                />
              </View>

              {/* Search Bar */}
              <View className="flex-row items-center bg-surface border border-line rounded-xl px-3 py-2.5 shadow-sm">
                <SearchIcon size={16} color="#64748b" />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search party, invoice or ref no…"
                  placeholderTextColor={C.faint}
                  className="flex-1 ml-2 text-[13px] text-ink font-medium"
                  autoCapitalize="none"
                />
                {q ? (
                  <Pressable onPress={() => setQ('')} hitSlop={8}>
                    <Text className="text-muted font-bold text-xs">✕</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Zone Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
                <Chip key="ALL" label={`All`} count={payments.length} active={zoneFilter === 'ALL'} onPress={() => setZoneFilter('ALL')} />
                {PAY_ZONES.map((z) => {
                  const cnt = payments.filter((p) => p.zone === z).length;
                  return (
                    <Chip
                      key={z}
                      label={z}
                      count={cnt}
                      active={zoneFilter === z}
                      onPress={() => setZoneFilter(z)}
                    />
                  );
                })}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) => <PayCard p={item} onPress={() => setOpenId(item.id)} />}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={<Empty text="No invoices match the selected filter." />}
        />
      )}

      {/* Payment Detail Sheet */}
      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.customerName || ''}
        subtitle={open ? `${open.refNo || open.invoiceNo} · ${inr(open.pending)} pending` : ''}
        footer={<ModalBtn label="Close" variant="ghost" onPress={() => setOpenId(null)} />}
      >
        {open ? <PayDetail p={open} /> : null}
      </Sheet>

      {/* Add Invoice Sheet */}
      <Sheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add invoice manually"
        subtitle="Log an outstanding receivable for tracking"
      >
        <AddPaymentForm onDone={() => setShowAdd(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

function PayCard({ p, onPress }: { p: PaymentX; onPress: () => void }) {
  const d = agingDays(p.dueDate || p.date) ?? 0;
  const bucket = agingBucket(d);

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-[14px] font-black text-ink">{p.customerName}</Text>
          <Text className="text-[11px] text-muted font-medium mt-0.5">
            Ref: {p.refNo || p.invoiceNo} · Date: {shortDate(p.date || p.dueDate)}
          </Text>
        </View>
        <Badge label={p.zone || 'Unassigned'} tone={zoneTone(p.zone)} small showDot />
      </View>

      {/* Metric Row */}
      <View className="flex-row items-center bg-surface3/60 rounded-xl p-2.5 my-2.5">
        <View className="flex-1">
          <Text className="text-[10px] text-muted font-extrabold uppercase">Aging</Text>
          <Text className="text-[12px] text-amber font-black mt-0.5">
            {d}d · <Text className="text-[11px] text-muted">{bucket}</Text>
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-[10px] text-muted font-extrabold uppercase">Opening</Text>
          <Text className="text-[12px] text-ink font-bold mt-0.5">{inr(p.opening ?? p.amount)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[10px] text-muted font-extrabold uppercase">Pending</Text>
          <Text className="text-[14px] text-danger font-black mt-0.5">{inr(p.pending)}</Text>
        </View>
      </View>

      {p.reason ? (
        <View className="bg-amber-soft/60 border border-amber-border/40 rounded-lg px-2.5 py-1.5 mb-2">
          <Text className="text-[11px] text-amber-dark font-semibold" numberOfLines={1}>
            Reason: <Text className="font-bold">{p.reason}</Text>
          </Text>
        </View>
      ) : null}

      {/* Reminder Mail Chips & Follow-up */}
      <View className="flex-row justify-between items-center pt-2 border-t border-line/80">
        <View className="flex-row items-center gap-2">
          <Text className="text-[10px] text-muted font-extrabold uppercase">Mail:</Text>
          {(['mail1', 'mail2', 'mail3', 'mail4'] as const).map((k, i) => {
            const on = p[k] === 'Yes';
            return (
              <Pressable
                key={k}
                onPress={() => actions.togglePaymentMail(p.id, k)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                className={`w-11 h-11 rounded-xl items-center justify-center border ${
                  on ? 'bg-brand border-brand' : 'bg-surface border-line'
                }`}
              >
                <Text className={`text-[11px] font-black ${on ? 'text-white' : 'text-muted'}`}>
                  M{i + 1}
                </Text>
                {on ? (
                  <Text className="text-[8px] text-white font-bold mt-0.5">Sent</Text>
                ) : (
                  <Text className="text-[8px] text-faint font-bold mt-0.5">Tap</Text>
                )}
              </Pressable>
            );
          })}
        </View>
        <Text className="text-[11px] text-muted font-bold">
          Next: <Text className="text-ink">{shortDate(p.nextFollowUp)}</Text>
        </Text>
      </View>
    </Card>
  );
}

function PayDetail({ p }: { p: PaymentX }) {
  const [next, setNext] = useState(p.nextFollowUp || '');
  const [reason, setReason] = useState(p.reason || '');
  const [remark, setRemark] = useState('');
  const d = agingDays(p.dueDate || p.date) ?? 0;

  return (
    <View className="gap-4">
      {/* Key Metrics */}
      <View className="flex-row flex-wrap gap-y-3 bg-surface3/60 rounded-xl p-3">
        <Info label="Invoice date" value={p.date || p.dueDate} />
        <Info label="Aging Status" value={`${d} days (${agingBucket(d)})`} />
        <Info label="Opening amount" value={inr(p.opening ?? p.amount)} />
        <Info label="Pending amount" value={inr(p.pending)} strong />
      </View>

      {/* Zone Selector Pills */}
      <Field label="Customer payment zone">
        <Pills
          options={PAY_ZONES}
          value={p.zone || 'Unassigned'}
          onChange={(z) => actions.updatePayment(p.id, { zone: z as PayZone })}
        />
      </Field>

      {/* Reason for Delay Input */}
      <View className="gap-1.5">
        <Field label="Reason for delay / Collection Status">
          <Input value={reason} onChangeText={setReason} placeholder="e.g. MSME, Awaiting bill approval, Dispute…" />
        </Field>
        <Pressable
          onPress={() => actions.updatePayment(p.id, { reason: reason.trim() })}
          className="self-start bg-brand-soft px-3.5 py-1.5 rounded-lg mt-1"
        >
          <Text className="text-brand-dark font-black text-xs">Save Reason</Text>
        </Pressable>
      </View>

      {/* Reminder Mails 1–4 Toggles */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">
          Reminder Mails Sent (1–4)
        </Text>
        <View className="flex-row items-center gap-2">
          {(['mail1', 'mail2', 'mail3', 'mail4'] as const).map((k, i) => {
            const on = p[k] === 'Yes';
            return (
              <Pressable
                key={k}
                onPress={() => actions.togglePaymentMail(p.id, k)}
                className={`flex-1 py-2.5 rounded-xl items-center justify-center border ${
                  on ? 'bg-brand border-brand' : 'bg-surface border-line'
                }`}
              >
                <Text className={`text-xs font-black ${on ? 'text-white' : 'text-muted'}`}>
                  Mail {i + 1}: {on ? 'Yes' : 'No'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Next Follow-up Date */}
      <View className="flex-row gap-2 items-end border-t border-line pt-3">
        <View className="flex-1">
          <Field label="Next follow-up date">
            <Input value={next} onChangeText={setNext} placeholder="YYYY-MM-DD" />
          </Field>
        </View>
        <Pressable
          onPress={() => actions.updatePayment(p.id, { nextFollowUp: next || null })}
          className="bg-brand px-4 py-[12px] rounded-xl"
        >
          <Text className="text-white font-black text-xs">Set Date</Text>
        </Pressable>
      </View>

      {/* Collection Notes / Remarks */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">
          Collection remarks ({p.remarks.length})
        </Text>
        {p.remarks.length === 0 ? (
          <Text className="text-xs text-muted">No remarks recorded yet.</Text>
        ) : (
          p.remarks.slice(0, 4).map((r, i) => (
            <View key={i} className="bg-surface rounded-xl border border-line p-3">
              <Text className="text-xs text-ink font-medium">{r.text}</Text>
              <Text className="text-[10px] text-muted font-bold mt-1">
                {r.by} · {shortDate(r.at.slice(0, 10))}
              </Text>
            </View>
          ))
        )}
        <Input value={remark} onChangeText={setRemark} placeholder="Add a collection note…" multiline />
        <Pressable
          onPress={() => {
            if (remark.trim()) {
              actions.addPaymentRemark(p.id, remark.trim());
              setRemark('');
            }
          }}
          className="self-start bg-brand-soft px-4 py-2 rounded-xl"
        >
          <Text className="text-brand-dark font-black text-xs">Add Remark</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AgingReports({ payments }: { payments: PaymentX[] }) {
  const buckets = ['0-30d', '31-60d', '61-90d', '91-120d', '121-150d', '150d+'];
  const totalPending = payments.reduce((s, p) => s + p.pending, 0);

  const byBucket = buckets.map((b) => {
    const list = payments.filter((p) => agingBucket(agingDays(p.dueDate || p.date)) === b);
    const sum = list.reduce((s, p) => s + p.pending, 0);
    return { bucket: b, count: list.length, sum, pct: totalPending > 0 ? (sum / totalPending) * 100 : 0 };
  });

  const byParty = useMemo(() => {
    const map: Record<string, { party: string; pending: number; count: number; maxDays: number; zone: PayZone }> = {};
    payments.forEach((p) => {
      const d = agingDays(p.dueDate || p.date) ?? 0;
      if (!map[p.customerName]) {
        map[p.customerName] = { party: p.customerName, pending: 0, count: 0, maxDays: d, zone: p.zone };
      }
      map[p.customerName].pending += p.pending;
      map[p.customerName].count += 1;
      if (d > map[p.customerName].maxDays) map[p.customerName].maxDays = d;
    });
    return Object.values(map).sort((a, b) => b.pending - a.pending);
  }, [payments]);

  return (
    <View className="gap-3.5">
      {/* Zone Breakdown */}
      <Card>
        <Text className="text-[14px] font-black text-ink mb-2.5">Zone-wise Pending</Text>
        <View className="flex-row flex-wrap gap-2">
          {PAY_ZONES.map((z) => {
            const list = payments.filter((p) => p.zone === z);
            const sum = list.reduce((s, p) => s + p.pending, 0);
            return (
              <View key={z} className="flex-1 min-w-[140px] p-3 rounded-xl border border-line bg-surface3/40">
                <Badge label={z} tone={zoneTone(z)} small showDot />
                <Text className="text-base font-black text-ink mt-2">{lakhs(sum)}</Text>
                <Text className="text-[10px] text-muted font-bold">{list.length} invoices</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Aging Matrix with Graphic Bars */}
      <Card>
        <Text className="text-[14px] font-black text-ink mb-2.5">Aging Matrix Breakdown</Text>
        <View className="gap-3">
          {byBucket.map((item) => (
            <View key={item.bucket} className="gap-1">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs font-black text-ink">{item.bucket}</Text>
                  <Text className="text-[11px] text-muted">({item.count} inv)</Text>
                </View>
                <Text className="text-xs font-black text-danger">{inr(item.sum)}</Text>
              </View>
              <Progress value={item.pct} tone={item.bucket === '0-30d' ? 'won' : item.bucket === '31-60d' ? 'hot' : 'lost'} height={5} />
            </View>
          ))}
        </View>
      </Card>

      {/* Party-wise Outstanding ranking */}
      <Card>
        <Text className="text-[14px] font-black text-ink mb-2.5">Top Parties by Pending Balance</Text>
        <View className="gap-2">
          {byParty.slice(0, 10).map((pt, i) => (
            <View key={pt.party} className="flex-row items-center justify-between py-2 border-b border-line/80">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-black text-ink" numberOfLines={1}>
                  {i + 1}. {pt.party}
                </Text>
                <Text className="text-[10px] text-muted font-semibold mt-0.5">
                  {pt.count} invoices · max {pt.maxDays}d old
                </Text>
              </View>
              <View className="items-end gap-1">
                <Text className="text-xs font-black text-brand">{inr(pt.pending)}</Text>
                <Badge label={pt.zone} tone={zoneTone(pt.zone)} small />
              </View>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

function AddPaymentForm({ onDone }: { onDone: () => void }) {
  const [party, setParty] = useState('');
  const [refNo, setRefNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState('');
  const [zone, setZone] = useState<PayZone>('Green Zone');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = () => {
    if (!party.trim() || !amount) {
      setErr('Enter party name and opening amount');
      return;
    }
    const amt = +amount || 0;
    const pend = pending === '' ? amt : +pending || 0;
    setSaving(true);
    setTimeout(() => {
      actions.addPayment({
        customerName: party.trim(),
        refNo: refNo.trim() || `REF-${Math.floor(Math.random() * 9000 + 1000)}`,
        invoiceNo: refNo.trim() || `INV-${Math.floor(Math.random() * 9000 + 1000)}`,
        amount: amt,
        opening: amt,
        pending: pend,
        dueDate: date,
        date,
        zone,
        reason: reason.trim(),
        nextFollowUp: null,
        mails: 0,
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => onDone(), 600);
    }, 400);
  };

  return (
    <View className="gap-3">
      <Field label="Party / Customer Name">
        <Input value={party} onChangeText={setParty} placeholder="Company name" />
      </Field>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field label="Invoice Date">
            <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="Ref / Invoice No">
            <Input value={refNo} onChangeText={setRefNo} placeholder="e.g. PMT/2026/001" />
          </Field>
        </View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field label="Opening Amount ₹">
            <Input value={amount} onChangeText={(t) => { setAmount(t); if (!pending) setPending(t); }} placeholder="0" keyboardType="numeric" />
          </Field>
        </View>
        <View className="flex-1">
          <Field label="Pending Amount ₹">
            <Input value={pending} onChangeText={setPending} placeholder="0" keyboardType="numeric" />
          </Field>
        </View>
      </View>
      <Field label="Payment Zone">
        <Pills options={PAY_ZONES} value={zone} onChange={setZone} />
      </Field>
      <Field label="Reason (optional)">
        <Input value={reason} onChangeText={setReason} placeholder="e.g. MSME, Awaiting bill approval…" />
      </Field>

      {err ? <Text className="text-xs text-danger font-bold">{err}</Text> : null}
      {saved ? (
        <View className="bg-brand-soft border border-brand-border/60 rounded-xl py-3 items-center">
          <Text className="text-brand-dark font-black text-sm">Invoice added successfully!</Text>
        </View>
      ) : (
        <View className="flex-row gap-2 mt-2">
          <ModalBtn label="Cancel" variant="ghost" onPress={onDone} />
          <ModalBtn label={saving ? 'Saving…' : 'Create Invoice'} onPress={saving ? () => {} : submit} />
        </View>
      )}
    </View>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="w-1/2 gap-0.5">
      <Text className="text-[10px] text-muted font-extrabold uppercase">{label}</Text>
      <Text className={`text-[13px] ${strong ? 'text-danger font-black' : 'text-ink font-bold'}`}>{value}</Text>
    </View>
  );
}
