import { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Chip, Avatar, Empty, KpiStrip, ListFooter } from '@/gs/kit';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { C } from '@/gs/theme';
import { useAuthUser } from '@/gs/auth';
import { useDebounced } from '@/gs/useDebounced';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, type CustomerRow } from '@/gs/queries/customers';
import { DeleteButton } from '@/gs/DeleteButton';
import {
  inr, tierTone, zoneTone, TIERS, AREAS,
} from '@/gs/domain';
import { SearchIcon, PhoneIcon, WhatsAppIcon } from '@/gs/icons';
import {
  CUSTOMER_CATEGORY_VALUES,
  PAYMENT_TERMS_VALUES,
  PAY_ZONE_VALUES,
  type CustomerCategoryValue,
  type PaymentTermsValue,
  type PayZoneValue,
} from '@greatsales/shared';

const TERMS_LABELS: Record<string, string> = {
  Immediate: 'Immediate',
  Credit15: '15 Days Credit',
  Credit30: '30 Days Credit',
  Credit45: '45 Days Credit',
  CashOnDelivery: 'Cash on Delivery',
  Advance50Balance: '50% Advance',
  AdvancePayment: '100% Advance',
};

const ZONE_LABELS: Record<string, string> = {
  GreenZone: 'Green Zone',
  YellowZone: 'Yellow Zone',
  RedZone: 'Red Zone',
  Blacklist: 'Blacklist',
};

export default function Customers() {
  const user = useAuthUser();
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<string>('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const deleteCustomer = useDeleteCustomer();
  const [editCust, setEditCust] = useState<CustomerRow | null>(null);

  // Search and tier go to the SERVER. They used to filter whatever the single
  // 100-row request had returned, so an account on page 3 of 417 could not be
  // found by typing its name.
  const debouncedQ = useDebounced(q, 300);
  const {
    items: customers,
    total,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCustomers({
    search: debouncedQ.trim() || undefined,
    category: tier === 'ALL' ? undefined : tier,
  });

  // Derived from the rows LOADED so far, and labelled as such below: a true
  // per-tier count needs one query per tier, which is not worth six requests
  // for a header strip. `total` is the honest number and comes from the server.
  const platCount = customers.filter((c) => c.category === 'Platinum').length;
  const goldCount = customers.filter((c) => c.category === 'Gold').length;
  const totalOutstanding = customers.reduce((s, c) => s + (c.outstanding || 0), 0);

  const rows = customers;
  const selectedCust = customers.find((c) => c.id === selectedCustId) || null;

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
            <Text className="text-[20px] font-black text-ink tracking-tight">My Customers</Text>
          </View>
          <Pressable onPress={() => setShowAdd(true)} className="bg-brand px-3.5 py-2 rounded-xl shadow-sm">
            <Text className="text-white font-black text-xs">+ Customer</Text>
          </Pressable>
        </View>
        {/* Zone 2 — KPI Strip */}
        <View className="mb-1.5">
          <KpiStrip items={[
            { label: 'Total', value: String(total) },
            { label: 'Platinum', value: String(platCount), accent: platCount > 0 },
            { label: 'Gold', value: String(goldCount) },
            { label: 'Receivables', value: inr(totalOutstanding), alert: totalOutstanding > 300000 },
          ]} />
        </View>
        {/* Zone 3 — Search + Tier Filter */}
        <View className="gap-2 pb-2">
          <View className="flex-row items-center bg-surface border border-line rounded-xl px-3 py-2.5">
            <SearchIcon size={16} color="#64748b" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search name, area, or contact…"
              placeholderTextColor={C.faint}
              className="flex-1 ml-2 text-[13px] text-ink font-medium"
              autoCapitalize="none"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}><Text className="text-muted font-bold text-sm">✕</Text></Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
            <Chip key="ALL" label="All Accounts" count={total} active={tier === 'ALL'} onPress={() => setTier('ALL')} />
            {TIERS.map((t) => (
              // No count: the chip narrows a SERVER query, so the only honest
              // number for an inactive tier would need its own request.
              <Chip key={t} label={t} active={tier === t} onPress={() => setTier(t)} />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Zone 4 — List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={C.brand} />
          <Text className="text-xs text-muted font-medium mt-3">Loading customers…</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          contentContainerClassName="p-4 pb-28 gap-2.5"
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => <CustCard c={item} onPress={() => setSelectedCustId(item.id)} />}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={<Empty text="No customer accounts match the filter." />}
          // Follows the cursor instead of stopping at the first page.
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          ListFooterComponent={
            <ListFooter
              shown={customers.length}
              total={total}
              loading={isFetchingNextPage}
            />
          }
        />
      )}

      {/* Customer 360 Detail Sheet */}
      <Sheet
        open={!!selectedCust}
        onClose={() => setSelectedCustId(null)}
        title={selectedCust?.name || ''}
        subtitle={selectedCust ? `${selectedCust.category || 'Silver'} Tier · ${selectedCust.area || 'General'}` : ''}
        footer={
          <>
            {selectedCust ? (
              <DeleteButton
                label="Delete"
                title={`Delete ${selectedCust.name}?`}
                body="The account is removed from your directory. Orders and invoices already raised against it are not deleted."
                onDelete={() => deleteCustomer.mutateAsync(selectedCust.id)}
                onDeleted={() => setSelectedCustId(null)}
              />
            ) : null}
            {selectedCust ? (
              <ModalBtn label="Edit" onPress={() => setEditCust(selectedCust)} />
            ) : null}
            <ModalBtn label="Close" variant="ghost" onPress={() => setSelectedCustId(null)} />
          </>
        }
      >
        {selectedCust ? <CustDetail c={selectedCust} /> : null}
      </Sheet>

      {/* Add Customer Sheet */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add new customer" subtitle="Created for sales and projection tracking">
        <AddCustomerForm onDone={() => setShowAdd(false)} />
      </Sheet>

      {/* Edit Customer Sheet */}
      <Sheet
        open={!!editCust}
        onClose={() => setEditCust(null)}
        title={`Edit ${editCust?.name ?? ''}`}
        subtitle="Corrections apply immediately across web and mobile"
      >
        {editCust ? (
          <AddCustomerForm
            customer={editCust}
            onDone={() => {
              setEditCust(null);
              setSelectedCustId(null);
            }}
          />
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

function CustCard({ c, onPress }: { c: CustomerRow; onPress: () => void }) {
  const phone = c.primaryContactPhone || '';
  const call = (e: any) => {
    e.stopPropagation();
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };
  const wa = (e: any) => {
    e.stopPropagation();
    if (phone) {
      Linking.openURL(`whatsapp://send?phone=91${phone}`).catch(() =>
        Linking.openURL(`https://wa.me/91${phone}`).catch(() => {})
      );
    }
  };

  const cat = c.category || 'Silver';
  const zone = c.payZone || 'GreenZone';

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-center gap-3">
        <Avatar name={c.name} size={44} color={c.outstanding > 0 ? C.amber : C.brand} />
        <View className="flex-1">
          <Text className="text-[14px] font-black text-ink">{c.name}</Text>
          <Text className="text-[11px] text-muted font-medium mt-0.5">
            {c.area || 'Area not set'} {c.industryName ? `· ${c.industryName}` : ''}
          </Text>
        </View>
        <Badge label={cat} tone={tierTone(cat)} small />
      </View>

      {/* Dues & Quick Contact Triggers */}
      <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-line/80 gap-2">
        <View className="flex-row items-center gap-2 flex-1">
          <Badge label={ZONE_LABELS[zone] || zone} tone={zoneTone(zone)} small showDot />
          {c.outstanding > 0 ? (
            <Text className="text-[11px] text-amber font-extrabold">Outstanding {inr(c.outstanding)}</Text>
          ) : (
            <Text className="text-[11px] text-brand font-extrabold">No dues</Text>
          )}
        </View>
        {phone ? (
          <View className="flex-row gap-1.5">
            <Pressable onPress={call} className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-surface3">
              <PhoneIcon size={12} color="#334155" />
              <Text className="text-[11px] font-bold text-ink2">Call</Text>
            </Pressable>
            <Pressable onPress={wa} className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-soft">
              <WhatsAppIcon size={12} color="#059669" />
              <Text className="text-[11px] font-bold text-brand-dark">WhatsApp</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Contact & Terms footer */}
      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-line/60">
        <Text className="text-[11px] text-muted font-medium">
          {c.primaryContactName || 'No contact'} {phone ? `· ${phone}` : ''}
        </Text>
        <View className="bg-surface3 px-2 py-0.5 rounded-md">
          <Text className="text-[10px] text-ink2 font-bold">{TERMS_LABELS[c.paymentTerms || ''] || c.paymentTerms || '30 Days Credit'}</Text>
        </View>
      </View>
    </Card>
  );
}

function CustDetail({ c }: { c: CustomerRow }) {
  return (
    <View className="gap-4">
      {/* Account Info */}
      <View className="flex-row flex-wrap gap-y-3 bg-surface3/60 rounded-xl p-3">
        <Info label="Contact Person" value={c.primaryContactName || '—'} />
        <Info label="Phone" value={c.primaryContactPhone || '—'} />
        <Info label="Payment Terms" value={TERMS_LABELS[c.paymentTerms || ''] || c.paymentTerms || '30 Days Credit'} />
        <Info label="Pay Zone" value={ZONE_LABELS[c.payZone || ''] || c.payZone || '—'} />
        <Info label="Industry" value={c.industryName || '—'} />
        <Info label="Area" value={c.area || '—'} />
        <Info label="Salesperson" value={c.salespersonName || '—'} />
        <Info label="Outstanding" value={inr(c.outstanding || 0)} />
      </View>
    </View>
  );
}

/**
 * Create OR edit a customer.
 *
 * `useUpdateCustomer` existed in this app with no caller — a customer created
 * on the phone could never be corrected there, so a typo in an account name or
 * a payment term agreed on a visit had to wait for someone at a desk. The
 * fields are the same either way, so this is one form rather than two that
 * drift.
 */
function AddCustomerForm({ customer, onDone }: { customer?: CustomerRow; onDone: () => void }) {
  const user = useAuthUser();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const editing = !!customer;
  const [name, setName] = useState(customer?.name ?? '');
  const [contact, setContact] = useState(customer?.primaryContactName ?? '');
  const [phone, setPhone] = useState(customer?.primaryContactPhone ?? '');
  const [wa, setWa] = useState(customer?.primaryContactPhone ?? '');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [area, setArea] = useState<string>(customer?.area ?? AREAS[0]);
  const [terms, setTerms] = useState<PaymentTermsValue>(
    (customer?.paymentTerms as PaymentTermsValue) ?? 'Credit30',
  );
  const [cat, setCat] = useState<CustomerCategoryValue>(
    (customer?.category as CustomerCategoryValue) ?? 'Silver',
  );
  const [zone, setZone] = useState<PayZoneValue>(
    (customer?.payZone as PayZoneValue) ?? 'GreenZone',
  );
  const [outstanding, setOutstanding] = useState(
    customer ? String(customer.outstanding ?? 0) : '',
  );
  const [err, setErr] = useState('');

  const pending = createCustomer.isPending || updateCustomer.isPending;

  const submit = () => {
    if (!name.trim()) { setErr('Enter the customer name'); return; }
    if (!user?.userId) { setErr('User session missing'); return; }

    const fields = {
      name: name.trim(),
      category: cat,
      area: area || null,
      paymentTerms: terms,
      payZone: zone,
      outstanding: outstanding === '' ? 0 : +outstanding || 0,
      contactName: contact.trim() || null,
      phone: phone.trim() || null,
      whatsapp: sameAsMobile ? (phone.trim() || null) : (wa.trim() || null),
      sameAsMobile,
    };

    const handlers = {
      onSuccess: () => {
        onDone();
      },
      onError: (e: any) => {
        setErr(e.message || 'Failed to save customer');
      },
    };

    if (editing) {
      // Ownership is deliberately NOT patched here: reassigning an account is
      // an admin action on the web console, and a rep editing a phone number
      // must not quietly take the account from a colleague.
      updateCustomer.mutate({ id: customer.id, patch: fields }, handlers);
      return;
    }

    createCustomer.mutate({
      ...fields,
      salespersonId: user.userId,
      division: 'LUB',
      active: true,
    }, handlers);
  };

  return (
    <View className="gap-3">
      <Field label="Customer Account Name"><Input value={name} onChangeText={setName} placeholder="Company name" /></Field>
      <Field label="Contact Person"><Input value={contact} onChangeText={setContact} placeholder="e.g. Priya Ramesh" /></Field>
      <Field label="Mobile Number"><Input value={phone} onChangeText={(t) => { setPhone(t); if (sameAsMobile) setWa(t); }} placeholder="10-digit mobile" keyboardType="phone-pad" /></Field>

      {/* WhatsApp toggle */}
      <View className="gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">WhatsApp Number</Text>
          <Pressable onPress={() => { setSameAsMobile(!sameAsMobile); if (!sameAsMobile) setWa(phone); }} className="flex-row items-center gap-1.5">
            <View className={`w-4 h-4 rounded border items-center justify-center ${sameAsMobile ? 'bg-brand border-brand' : 'border-line bg-surface'}`}>
              {sameAsMobile ? <Text className="text-white text-[10px] font-black">✓</Text> : null}
            </View>
            <Text className="text-xs text-muted font-bold">Same as mobile</Text>
          </Pressable>
        </View>
        {!sameAsMobile ? (
          <Input value={wa} onChangeText={setWa} placeholder="WhatsApp number" keyboardType="phone-pad" />
        ) : null}
      </View>

      <Field label="Industrial Area"><Pills options={AREAS} value={area} onChange={setArea} /></Field>
      <Field label="Account Tier"><Pills options={CUSTOMER_CATEGORY_VALUES as unknown as string[]} value={cat} onChange={(v) => setCat(v as CustomerCategoryValue)} /></Field>
      <Field label="Agreed Payment Terms">
        <Pills options={PAYMENT_TERMS_VALUES as unknown as string[]} value={terms} onChange={(v) => setTerms(v as PaymentTermsValue)} />
      </Field>
      <Field label="Initial Pay Zone">
        <Pills options={PAY_ZONE_VALUES as unknown as string[]} value={zone} onChange={(v) => setZone(v as PayZoneValue)} />
      </Field>
      <Field label="Opening Outstanding ₹"><Input value={outstanding} onChangeText={setOutstanding} placeholder="0" keyboardType="numeric" /></Field>

      {err ? <Text className="text-xs text-danger font-bold">{err}</Text> : null}
      <View className="flex-row gap-2 mt-1">
        <ModalBtn label="Cancel" variant="ghost" onPress={onDone} />
        <ModalBtn
          label={pending ? 'Saving…' : editing ? 'Save Changes' : 'Create Customer'}
          disabled={pending}
          onPress={submit}
        />
      </View>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 gap-0.5">
      <Text className="text-[10px] text-muted font-extrabold uppercase">{label}</Text>
      <Text className="text-[13px] text-ink font-bold">{value}</Text>
    </View>
  );
}
