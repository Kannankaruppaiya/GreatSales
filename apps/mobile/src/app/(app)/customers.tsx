import { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Chip, Avatar, Empty, KpiStrip, ListFooter } from '@/gs/kit';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { C, NUM, useC } from '@/gs/theme';
import { Row, RowAvatar, RowSkeleton, RowEmpty, type RowTone } from '@/gs/Row';
import { RemarksPanel } from '@/gs/RemarksPanel';
import { useAuthUser } from '@/gs/auth';
import { useDebounced } from '@/gs/useDebounced';
import { useCustomers, useCustomer, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, type CustomerRow } from '@/gs/queries/customers';
import { DeleteButton } from '@/gs/DeleteButton';
import { LocationPin, type Pin } from '@/gs/LocationPin';
import {
  inr, tierTone, zoneTone, TIERS, AREAS,
} from '@/gs/domain';
import { SearchIcon, PhoneIcon, WhatsAppIcon, CloseIcon } from '@/gs/icons';
import {
  CUSTOMER_CATEGORY_VALUES,
  PAYMENT_TERMS_VALUES,
  PAY_ZONE_VALUES,
  type CustomerCategoryValue,
  type PaymentTermsValue,
  type PayZoneValue,
  mapsUrl,
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
  const p = useC();
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

  // Only the outstanding figure survives from the old four-tile KPI strip. The
  // other three were `Total`, which the header already says, and Platinum/Gold
  // counts derived from the rows loaded so far — which read `0` on a 417-account
  // tenant and spent half the strip saying nothing.
  const totalOutstanding = customers.reduce((s, c) => s + (c.outstanding || 0), 0);

  const rows = customers;
  // The list row is the fallback while the fresh record is in flight, so the
  // sheet opens instantly and then corrects itself rather than flashing empty.
  const selectedRow = customers.find((c) => c.id === selectedCustId) || null;
  const { data: freshCust } = useCustomer(selectedCustId, { enabled: selectedCustId != null });
  const selectedCust = freshCust ?? selectedRow;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Sticky Zones 1-3 */}
      <View className="bg-canvas border-b border-line/50 px-4 pt-2 pb-0 gap-1">
        {/* Zone 1 */}
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Text className="text-[20px] font-black text-ink tracking-tight">Accounts</Text>
            <Text className="text-[12px] font-medium text-muted" style={NUM}>
              {total} accounts
              {totalOutstanding > 0 ? ` · ${inr(totalOutstanding)} outstanding` : ''}
            </Text>
          </View>
          <Pressable onPress={() => setShowAdd(true)} className="bg-brand px-3.5 py-2 rounded-xl shadow-sm">
            <Text className="text-white font-black text-xs">+ Customer</Text>
          </Pressable>
        </View>
        {/* Search first. With 417 accounts, scrolling is not a way to find one. */}
        <View className="gap-2 pb-2">
          <View className="flex-row items-center bg-surface border border-line rounded-xl px-3 py-2.5">
            <SearchIcon size={16} color={p.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search name, area, or contact…"
              placeholderTextColor={p.faint}
              className="flex-1 ml-2 text-[13px] text-ink font-medium"
              autoCapitalize="none"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}>
                <CloseIcon size={14} color={p.muted} />
              </Pressable>
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

      {/* The list. A skeleton rather than a spinner while the first page lands —
          it holds the shape the rows are about to take. */}
      {isLoading ? (
        <RowSkeleton />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <AccountRow c={item} onPress={() => setSelectedCustId(item.id)} />
          )}
          ListEmptyComponent={
            <RowEmpty
              title={q ? `Nothing matches “${q}”` : 'No accounts yet'}
              hint={
                q
                  ? 'Search covers name, area and contact.'
                  : 'Add the first account to start tracking orders and collections against it.'
              }
              action={q ? undefined : { label: '+ Add customer', onPress: () => setShowAdd(true) }}
            />
          }
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
        {selectedCust ? (
          <View className="gap-5">
            <CustDetail c={selectedCust} />
            <RemarksPanel entityType="Customer" entityId={selectedCust.id} />
          </View>
        ) : null}
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

/**
 * One account, in four slots.
 *
 * The card this replaces printed nine fields over ~180px, so three accounts
 * fitted on a screen out of four hundred and seventeen. Six of those nine
 * ("Others · General Engineering", "Silver", "Green Zone", "No dues",
 * "No contact", "30 Days Credit") were identical on every row in the tenant —
 * they told you nothing about which account you were looking at, and they cost
 * you the next five rows. They live on the detail sheet now.
 *
 * What is left is what actually differs: who it is, what they owe, where they
 * are, and how overdue they are. Zone becomes the edge bar; calling and
 * WhatsApp become a swipe rather than two buttons competing with the row's own
 * tap target.
 */
function AccountRow({ c, onPress }: { c: CustomerRow; onPress: () => void }) {
  const phone = c.primaryContactPhone || '';

  const call = () => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };
  const wa = () => {
    if (!phone) return;
    Linking.openURL(`whatsapp://send?phone=91${phone}`).catch(() =>
      Linking.openURL(`https://wa.me/91${phone}`).catch(() => {}),
    );
  };

  const zone = c.payZone || 'GreenZone';
  const tone: RowTone =
    zone === 'RedZone' || zone === 'Blacklist' ? 'danger' : zone === 'YellowZone' ? 'amber' : 'none';

  // Category earns its place only when it is not the default every row carries.
  const place = [c.area, c.industryName].filter(Boolean).join(' · ');
  const cat = c.category && c.category !== 'Silver' ? c.category : null;

  return (
    <Row
      leading={<RowAvatar text={c.name} tone={tone} />}
      title={c.name}
      value={c.outstanding > 0 ? inr(c.outstanding) : undefined}
      valueAlert={tone === 'danger'}
      subtitle={place || 'Area not set'}
      meta={cat ?? (zone !== 'GreenZone' ? ZONE_LABELS[zone] : undefined)}
      tone={tone}
      onPress={onPress}
      actions={
        phone
          ? [
              { label: 'Call', tone: 'info', onPress: call, icon: (col, sz) => <PhoneIcon size={sz} color={col} /> },
              { label: 'WhatsApp', tone: 'brand', onPress: wa, icon: (col, sz) => <WhatsAppIcon size={sz} color={col} /> },
            ]
          : undefined
      }
    />
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

      {/* Sharing lives here as well as in the edit form: sending a driver an
          address is a lookup, not an edit, and making someone open the edit
          sheet to do it invites accidental changes. */}
      <View className="gap-1.5">
        <Text className="text-[10px] text-muted font-extrabold uppercase">Location</Text>
        <CustomerLocationShare c={c} />
      </View>
    </View>
  );
}

/** Read-only pin with the two things a lookup needs: share it, or open it. */
function CustomerLocationShare({ c }: { c: CustomerRow }) {
  const url = c.locationUrl ?? mapsUrl(c.latitude, c.longitude);
  if (!url) {
    return (
      <Text className="text-xs text-muted">
        No location pinned. Edit this customer while you are at their place to pin it.
      </Text>
    );
  }
  return (
    <View className="gap-2">
      <Text className="text-[12px] text-body">
        {c.latitude?.toFixed(5)}, {c.longitude?.toFixed(5)}
        {c.locationAccuracyM != null ? ` · ±${c.locationAccuracyM}m` : ''}
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share location"
          onPress={() =>
            Share.share({ message: `${c.name} — location
${url}`, url })
          }
          className="bg-brand rounded-lg px-3.5 py-2"
        >
          <Text className="text-white text-[13px] font-bold">Share location</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open in maps"
          onPress={() => Linking.openURL(url)}
          className="bg-surface3 rounded-lg px-3.5 py-2"
        >
          <Text className="text-body text-[13px] font-bold">Open map</Text>
        </Pressable>
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
  const [pin, setPin] = useState<Pin | null>(
    customer?.latitude != null && customer?.longitude != null
      ? {
          latitude: customer.latitude,
          longitude: customer.longitude,
          locationAccuracyM: customer.locationAccuracyM,
        }
      : null,
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
      // Sent as an explicit null when cleared, so the patch removes the pin
      // rather than leaving the old one in place.
      latitude: pin?.latitude ?? null,
      longitude: pin?.longitude ?? null,
      locationAccuracyM: pin?.locationAccuracyM ?? null,
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

      <Field label="Customer Location">
        <LocationPin
          value={pin}
          accuracyM={pin?.locationAccuracyM}
          pinnedAt={customer?.locationPinnedAt}
          pinnedByName={customer?.locationPinnedByName}
          customerName={name.trim() || customer?.name}
          onChange={setPin}
          disabled={pending}
        />
      </Field>

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
