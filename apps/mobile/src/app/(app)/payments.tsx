import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Chip, Empty, Kpi, Progress, KpiStrip } from '@/gs/kit';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { C, NUM, useC } from '@/gs/theme';
import { Row, RowSkeleton, RowEmpty, type RowTone } from '@/gs/Row';
import { RemarksPanel } from '@/gs/RemarksPanel';
import { useDebounced } from '@/gs/useDebounced';
import { usePayments, useCreatePayment, useUpdatePayment, useDeletePayment, type PaymentRow } from '@/gs/queries/payments';
import { DeleteButton } from '@/gs/DeleteButton';
import { inr, lakhs, shortDate, agingDays, agingBucket, zoneTone } from '@/gs/domain';
import { SearchIcon, WalletIcon, CloseIcon, PaperPlaneIcon } from '@/gs/icons';
import { PAY_ZONE_VALUES, type PayZoneValue } from '@greatsales/shared';

const ZONE_OPTIONS = ['ALL', ...PAY_ZONE_VALUES, 'Unassigned'] as const;

const ZONE_LABELS: Record<string, string> = {
  GreenZone: 'Green Zone',
  YellowZone: 'Yellow Zone',
  RedZone: 'Red Zone',
  Blacklist: 'Blacklist',
  Unassigned: 'Unassigned',
  ALL: 'All Zones',
};

export default function Payments() {
  const pal = useC();
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounced(searchText, 300);
  // Receivables KPIs and the report tab are sums over the whole ledger; a
  // first-page total would understate what is owed, which is the one number on
  // this screen nobody may guess at.
  const {
    items: payments,
    total,
    isLoadingAll: isLoading,
    refetch,
  } = usePayments(
    { search: debouncedSearch.trim() || undefined },
    { autoFetchAll: true },
  );
  const [tab, setTab] = useState<'list' | 'report'>('list');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const deletePayment = useDeletePayment();
  const [showAdd, setShowAdd] = useState(false);

  // Financial KPIs
  const totalPending = payments.reduce((s, p) => s + p.pending, 0);
  const redZoneVal = payments.filter((p) => p.payZone === 'RedZone').reduce((s, p) => s + p.pending, 0);
  const over90Val = payments.filter((p) => (agingDays(p.dueDate || p.invoiceDate) ?? 0) > 90).reduce((s, p) => s + p.pending, 0);
  const fuDueCount = payments.filter((p) => {
    const d = agingDays(p.nextFollowUp);
    return d != null && d >= 0;
  }).length;

  const filtered = useMemo(() => payments.filter((p) => {
    if (zoneFilter !== 'ALL') {
      if (zoneFilter === 'Unassigned') {
        if (p.payZone != null) return false;
      } else if (p.payZone !== zoneFilter) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => (agingDays(b.dueDate || b.invoiceDate) ?? 0) - (agingDays(a.dueDate || a.invoiceDate) ?? 0)), [payments, zoneFilter]);

  const open = payments.find((p) => p.id === openId) || null;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Sticky Header Zones 1-3 */}
      <View className="bg-canvas border-b border-line/50 px-4 pt-2 pb-0 gap-1">
        {/* Zone 1 */}
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Text className="text-[20px] font-black text-ink tracking-tight">Money</Text>
            {/* One line instead of four tiles. The old strip printed Outstanding
                and Over-90d, which on this tenant were the same figure twice, and
                a Red Zone total the chips below already break down. */}
            <Text className="text-[12px] font-medium text-muted" style={NUM}>
              {lakhs(totalPending)} outstanding · {payments.length} invoices
              {fuDueCount > 0 ? ` · ${fuDueCount} due` : ''}
            </Text>
          </View>
          <Pressable onPress={() => setShowAdd(true)} className="bg-brand px-3.5 py-2 rounded-xl shadow-sm">
            <Text className="text-white font-black text-xs">+ Invoice</Text>
          </Pressable>
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
            {ZONE_OPTIONS.map((z) => {
              const count = z === 'ALL'
                ? payments.length
                : z === 'Unassigned'
                  ? payments.filter((p) => p.payZone == null).length
                  : payments.filter((p) => p.payZone === z).length;
              return (
                <Chip
                  key={z}
                  label={ZONE_LABELS[z] || z}
                  count={count}
                  active={zoneFilter === z}
                  onPress={() => setZoneFilter(z)}
                />
              );
            })}
          </ScrollView>
        </View>
      </View>

      {isLoading ? (
        <RowSkeleton />
      ) : tab === 'report' ? (
        <ScrollView className="flex-1 px-4 pb-28" contentContainerClassName="gap-3 py-3">
          <AgingReports payments={payments} />
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          ListHeaderComponent={
            <View className="gap-3 mb-1">
              {/* Search Bar */}
              <View className="flex-row items-center bg-surface border border-line rounded-xl px-3 py-2.5 shadow-sm">
                <SearchIcon size={16} color={pal.muted} />
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search party, invoice or ref no…"
                  placeholderTextColor={pal.faint}
                  className="flex-1 ml-2 text-[13px] text-ink font-medium"
                  autoCapitalize="none"
                />
                {searchText ? (
                  <Pressable onPress={() => setSearchText('')} hitSlop={8}>
                    <CloseIcon size={14} color={pal.muted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          }
          renderItem={({ item }) => <InvoiceRow p={item} onPress={() => setOpenId(item.id)} />}
          ListEmptyComponent={
            <RowEmpty
              title="Nothing outstanding here"
              hint="No invoice matches this zone and search. Collections that are settled drop out of the list."
            />
          }
        />
      )}

      {/* Payment Detail Sheet */}
      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.customerName || 'Payment Details'}
        subtitle={open ? `${open.refNo || open.invoiceNo || 'INV'} · ${inr(open.pending)} pending` : ''}
        footer={
          <>
            {open ? (
              <DeleteButton
                label="Delete"
                title={`Delete ${open.refNo || open.invoiceNo || 'this invoice'}?`}
                body="The invoice and everything received against it are removed from the ledger, and the customer's outstanding changes."
                onDelete={() => deletePayment.mutateAsync(open.id)}
                onDeleted={() => setOpenId(null)}
              />
            ) : null}
            <ModalBtn label="Close" variant="ghost" onPress={() => setOpenId(null)} />
          </>
        }
      >
        {open ? (
          <View className="gap-5">
            <PayDetail p={open} />
            <RemarksPanel entityType="Payment" entityId={open.id} />
          </View>
        ) : null}
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

/**
 * One invoice, in four slots.
 *
 * The card this replaces stood 184px tall, so two and a half of a hundred and
 * forty-one invoices fitted on a screen. It printed the aging bucket ("150d+")
 * on every row, and Total beside Pending — which are the same number on every
 * unpaid invoice, so one of the two columns was always redundant.
 *
 * The M1–M4 matrix is gone from the row. Four 40pt targets 4pt apart is a
 * mis-tap waiting to happen, and while your thumb is on M2 it covers M1 and M3,
 * so you cannot see which one turned green. Sending the next reminder is now
 * one swipe, and the row says in words how far the chase has got.
 */
function InvoiceRow({ p, onPress }: { p: PaymentRow; onPress: () => void }) {
  const updatePayment = useUpdatePayment();
  const d = agingDays(p.dueDate || p.invoiceDate) ?? 0;

  const zone = p.payZone;
  const tone: RowTone =
    zone === 'RedZone' || zone === 'Blacklist' ? 'danger' : zone === 'YellowZone' ? 'amber' : 'none';

  // How far the reminder chase has got, as a phrase rather than four buttons.
  const stages = [p.mail1, p.mail2, p.mail3, p.mail4];
  const sent = stages.filter(Boolean).length;
  const nextStage = (['mail1', 'mail2', 'mail3', 'mail4'] as const)[sent];

  const ref = p.refNo || p.invoiceNo;

  return (
    <Row
      title={p.customerName || 'Unknown customer'}
      value={inr(p.pending)}
      valueAlert={tone === 'danger'}
      subtitle={[ref ? `Ref ${ref}` : null, d > 0 ? `${d}d overdue` : null]
        .filter(Boolean)
        .join(' · ')}
      meta={sent > 0 ? `M${sent} sent` : 'No reminder'}
      tone={tone}
      onPress={onPress}
      actions={
        nextStage
          ? [
              {
                label: `Send M${sent + 1}`,
                tone: 'brand',
                onPress: () => updatePayment.mutate({ id: p.id, patch: { [nextStage]: true } }),
                icon: (col, sz) => <PaperPlaneIcon size={sz} color={col} />,
              },
            ]
          : undefined
      }
    />
  );
}

function PayDetail({ p }: { p: PaymentRow }) {
  const updatePayment = useUpdatePayment();
  const [next, setNext] = useState(p.nextFollowUp || '');
  const [reason, setReason] = useState(p.delayReason || '');
  const d = agingDays(p.dueDate || p.invoiceDate) ?? 0;

  return (
    <View className="gap-4">
      {/* Key Metrics */}
      <View className="flex-row flex-wrap gap-y-3 bg-surface3/60 rounded-xl p-3">
        <Info label="Invoice date" value={shortDate(p.invoiceDate || p.dueDate)} />
        <Info label="Aging Status" value={`${d} days (${agingBucket(d)})`} />
        <Info label="Total amount" value={inr(p.amount)} />
        <Info label="Pending amount" value={inr(p.pending)} strong />
      </View>

      {/* Zone Selector Pills */}
      <Field label="Customer payment zone">
        <Pills
          options={PAY_ZONE_VALUES as unknown as string[]}
          value={p.payZone || ''}
          onChange={(z) => updatePayment.mutate({ id: p.id, patch: { payZone: z as PayZoneValue } })}
        />
      </Field>

      {/* Reason for Delay Input */}
      <View className="gap-1.5">
        <Field label="Reason for delay / Collection Status">
          <Input value={reason} onChangeText={setReason} placeholder="e.g. MSME, Awaiting bill approval, Dispute…" />
        </Field>
        <Pressable
          onPress={() => updatePayment.mutate({ id: p.id, patch: { delayReason: reason.trim() } })}
          disabled={updatePayment.isPending}
          className="self-start bg-brand-soft px-3.5 py-1.5 rounded-lg mt-1"
        >
          <Text className="text-brand-dark font-black text-xs">
            {updatePayment.isPending ? 'Saving…' : 'Save Reason'}
          </Text>
        </Pressable>
      </View>

      {/* Reminder Mails 1–4 Toggles */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">
          Reminder Mails Sent (1–4)
        </Text>
        <View className="flex-row items-center gap-2">
          {(['mail1', 'mail2', 'mail3', 'mail4'] as const).map((k, i) => {
            const on = !!p[k];
            return (
              <Pressable
                key={k}
                onPress={() => updatePayment.mutate({ id: p.id, patch: { [k]: !on } })}
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
          onPress={() => updatePayment.mutate({ id: p.id, patch: { nextFollowUp: next || null } })}
          disabled={updatePayment.isPending}
          className="bg-brand px-4 py-[12px] rounded-xl"
        >
          <Text className="text-white font-black text-xs">
            {updatePayment.isPending ? 'Saving…' : 'Set Date'}
          </Text>
        </Pressable>
      </View>

      {/* Follow-ups log */}
      {p.followups && p.followups.length > 0 ? (
        <View className="gap-2 border-t border-line pt-3">
          <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">
            Follow-up History ({p.followups.length})
          </Text>
          {p.followups.slice(0, 3).map((fu) => (
            <View key={fu.id} className="bg-surface rounded-xl border border-line p-3">
              <Text className="text-xs text-ink font-medium">{fu.note}</Text>
              <Text className="text-[10px] text-muted font-bold mt-1">{shortDate(fu.date)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AgingReports({ payments }: { payments: PaymentRow[] }) {
  const buckets = ['0-30d', '31-60d', '61-90d', '91-120d', '121-150d', '150d+'];
  const totalPending = payments.reduce((s, p) => s + p.pending, 0);

  const byBucket = buckets.map((b) => {
    const list = payments.filter((p) => agingBucket(agingDays(p.dueDate || p.invoiceDate)) === b);
    const sum = list.reduce((s, p) => s + p.pending, 0);
    return { bucket: b, count: list.length, sum, pct: totalPending > 0 ? (sum / totalPending) * 100 : 0 };
  });

  const byParty = useMemo(() => {
    const map: Record<string, { party: string; pending: number; count: number; maxDays: number; zone: string }> = {};
    payments.forEach((p) => {
      const party = p.customerName || 'Unknown';
      const d = agingDays(p.dueDate || p.invoiceDate) ?? 0;
      if (!map[party]) {
        map[party] = { party, pending: 0, count: 0, maxDays: d, zone: p.payZone || 'Unassigned' };
      }
      map[party].pending += p.pending;
      map[party].count += 1;
      if (d > map[party].maxDays) map[party].maxDays = d;
    });
    return Object.values(map).sort((a, b) => b.pending - a.pending);
  }, [payments]);

  return (
    <View className="gap-3.5">
      {/* Zone Breakdown */}
      <Card>
        <Text className="text-[14px] font-black text-ink mb-2.5">Zone-wise Pending</Text>
        <View className="flex-row flex-wrap gap-2">
          {PAY_ZONE_VALUES.map((z) => {
            const list = payments.filter((p) => p.payZone === z);
            const sum = list.reduce((s, p) => s + p.pending, 0);
            return (
              <View key={z} className="flex-1 min-w-[140px] p-3 rounded-xl border border-line bg-surface3/40">
                <Badge label={ZONE_LABELS[z] || z} tone={zoneTone(z)} small showDot />
                <Text className="text-base font-black text-ink mt-2">{lakhs(sum)}</Text>
                <Text className="text-[10px] text-muted font-bold">{list.length} invoices</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Aging Matrix */}
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
                <Badge label={ZONE_LABELS[pt.zone] || pt.zone} tone={zoneTone(pt.zone)} small />
              </View>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

function AddPaymentForm({ onDone }: { onDone: () => void }) {
  const createPayment = useCreatePayment();
  const [party, setParty] = useState('');
  const [refNo, setRefNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState('');
  const [zone, setZone] = useState<PayZoneValue>('GreenZone');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  const submit = () => {
    if (!party.trim() || !amount) {
      setErr('Enter party name and opening amount');
      return;
    }
    const amt = +amount || 0;
    const pend = pending === '' ? amt : +pending || 0;
    const received = Math.max(0, amt - pend);

    createPayment.mutate({
      customerName: party.trim(),
      refNo: refNo.trim() || `REF-${Math.floor(Math.random() * 9000 + 1000)}`,
      invoiceNo: refNo.trim() || `INV-${Math.floor(Math.random() * 9000 + 1000)}`,
      amount: amt,
      received,
      invoiceDate: date,
      dueDate: date,
      payZone: zone,
      delayReason: reason.trim() || null,
    }, {
      onSuccess: () => {
        onDone();
      },
      onError: (e: any) => {
        setErr(e.message || 'Failed to create invoice');
      },
    });
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
          <Field label="Total Amount ₹">
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
        <Pills options={PAY_ZONE_VALUES as unknown as string[]} value={zone} onChange={(z) => setZone(z as PayZoneValue)} />
      </Field>
      <Field label="Reason (optional)">
        <Input value={reason} onChangeText={setReason} placeholder="e.g. MSME, Awaiting bill approval…" />
      </Field>

      {err ? <Text className="text-xs text-danger font-bold">{err}</Text> : null}

      <View className="flex-row gap-2 mt-2">
        <ModalBtn label="Cancel" variant="ghost" onPress={onDone} />
        <ModalBtn label={createPayment.isPending ? 'Saving…' : 'Create Invoice'} onPress={submit} />
      </View>
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
