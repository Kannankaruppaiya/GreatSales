import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Badge, Chip, Avatar, Empty, KpiStrip, QuickActionRow } from '@/gs/kit';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { C } from '@/gs/theme';
import { useStore, actions, CustomerX } from '@/gs/store';
import {
  inr, tierTone, zoneTone, TIERS, INDUSTRIES, AREAS, PAY_ZONES, PRINCIPALS, PAYMENT_TERMS,
  type Customer, type Tier, type PayZone,
} from '@/gs/domain';
import { SearchIcon, PhoneIcon, WhatsAppIcon } from '@/gs/icons';

export default function Customers() {
  const customers = useStore((s) => s.customers);
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<string>('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);

  const payments = useStore((s) => s.payments);
  const platCount = customers.filter((c) => c.tier === 'Platinum').length;
  const goldCount = customers.filter((c) => c.tier === 'Gold').length;
  const totalOutstanding = payments.reduce((s, p) => s + p.pending, 0);

  const rows = useMemo(() => customers.filter((c) => {
    if (tier !== 'ALL' && c.tier !== tier) return false;
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !c.area.toLowerCase().includes(q.toLowerCase()) && !(c.contactName || '').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [customers, q, tier]);

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
            { label: 'Total', value: String(customers.length) },
            { label: 'Platinum', value: String(platCount), accent: platCount > 0 },
            { label: 'Gold', value: String(goldCount) },
            { label: 'Receivables', value: inr(totalOutstanding).replace(',00,000','L'), alert: totalOutstanding > 300000 },
          ]} />
        </View>
        {/* Zone 3 — Search + Tier Filter */}
        <View className="gap-2 pb-2">
          <View className="flex-row items-center bg-surface border border-line rounded-xl px-3 py-2.5">
            <SearchIcon size={16} color="#64748b" />
            <TextInput value={q} onChangeText={setQ} placeholder="Search name, area, or contact…" placeholderTextColor={C.faint}
              className="flex-1 ml-2 text-[13px] text-ink font-medium" autoCapitalize="none" />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}><Text className="text-muted font-bold text-sm">x</Text></Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
            <Chip key="ALL" label="All Accounts" count={customers.length} active={tier === 'ALL'} onPress={() => setTier('ALL')} />
            {TIERS.map((t) => (
              <Chip key={t} label={t} count={customers.filter((c) => c.tier === t).length} active={tier === t} onPress={() => setTier(t)} />
            ))}
          </ScrollView>
        </View>
      </View>
      {/* Zone 4 — List */}
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        contentContainerClassName="p-4 pb-28 gap-2.5"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <CustCard c={item} onPress={() => setSelectedCustId(item.id)} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={<Empty text="No customer accounts match the filter." />}
      />

      {/* Customer 360 Detail Sheet */}
      <Sheet
        open={!!selectedCust}
        onClose={() => setSelectedCustId(null)}
        title={selectedCust?.name || ''}
        subtitle={selectedCust ? `${selectedCust.tier} Tier · ${selectedCust.area}` : ''}
        footer={<ModalBtn label="Close" variant="ghost" onPress={() => setSelectedCustId(null)} />}
      >
        {selectedCust ? <CustDetail c={selectedCust} /> : null}
      </Sheet>

      {/* Add Customer Sheet */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add new customer" subtitle="Created for recurring sales tracking">
        <AddCustomerForm onDone={() => setShowAdd(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

function CustCard({ c, onPress }: { c: CustomerX; onPress: () => void }) {
  const call = (e: any) => { e.stopPropagation(); Linking.openURL(`tel:${c.phone}`).catch(() => {}); };
  const wa = (e: any) => {
    e.stopPropagation();
    const num = c.whatsapp || c.phone;
    Linking.openURL(`whatsapp://send?phone=91${num}`).catch(() => Linking.openURL(`https://wa.me/91${num}`).catch(() => {}));
  };

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-center gap-3">
        <Avatar name={c.name} size={44} color={c.outstanding > 0 ? C.amber : C.brand} />
        <View className="flex-1">
          <Text className="text-[14px] font-black text-ink">{c.name}</Text>
          <Text className="text-[11px] text-muted font-medium mt-0.5">
            {c.area} · {c.industry.split(' &')[0]}
          </Text>
        </View>
        <Badge label={c.tier} tone={tierTone(c.tier)} small />
      </View>

      {/* Dues & Quick Contact Triggers */}
      <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-line/80 gap-2">
        <View className="flex-row items-center gap-2 flex-1">
          <Badge label={c.payZone} tone={zoneTone(c.payZone)} small showDot />
          {c.outstanding > 0 ? (
            <Text className="text-[11px] text-amber font-extrabold">Outstanding {inr(c.outstanding)}</Text>
          ) : (
            <Text className="text-[11px] text-brand font-extrabold">No dues</Text>
          )}
        </View>
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
      </View>

      {/* Contact & Terms footer */}
      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-line/60">
        <Text className="text-[11px] text-muted font-medium">
          {c.contactName} · {c.phone}
        </Text>
        <View className="bg-surface3 px-2 py-0.5 rounded-md">
          <Text className="text-[10px] text-ink2 font-bold">{c.paymentTerms || '30 Days Credit'}</Text>
        </View>
      </View>
    </Card>
  );
}

function CustDetail({ c }: { c: CustomerX }) {
  const [newPrincipal, setNewPrincipal] = useState<string>(PRINCIPALS[0]);
  const [newProduct, setNewProduct] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [showAddMap, setShowAddMap] = useState(false);

  const handleAddMap = () => {
    if (!newProduct.trim()) return;
    actions.addCustomerMapping(c.id, {
      principal: newPrincipal,
      product: newProduct.trim(),
      price: +newPrice || 180,
    });
    setNewProduct('');
    setNewPrice('');
    setShowAddMap(false);
  };

  return (
    <View className="gap-4">
      {/* Account Info */}
      <View className="flex-row flex-wrap gap-y-3 bg-surface3/60 rounded-xl p-3">
        <Info label="Contact Person" value={c.contactName || '—'} />
        <Info label="Phone" value={c.phone || '—'} />
        <Info label="WhatsApp" value={c.whatsapp || c.phone || '—'} />
        <Info label="Payment Terms" value={c.paymentTerms || '30 Days Credit'} />
        <Info label="Industry" value={c.industry} />
        <Info label="Area & Address" value={`${c.area}${c.address ? `, ${c.address}` : ''}`} />
      </View>

      {/* Mapped Products List */}
      <View className="gap-2 border-t border-line pt-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">
            Mapped Products ({c.mappings?.length || 0})
          </Text>
          <Pressable onPress={() => setShowAddMap(!showAddMap)}>
            <Text className="text-xs font-black text-brand">+ Map New Product</Text>
          </Pressable>
        </View>

        {c.mappings && c.mappings.length > 0 ? (
          c.mappings.map((m, i) => (
            <View key={i} className="flex-row items-center justify-between p-3 rounded-xl border border-line bg-surface shadow-sm">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-black text-ink">{m.product}</Text>
                <Text className="text-[10px] text-muted font-medium mt-0.5">{m.principal}</Text>
              </View>
              <Text className="text-xs font-black text-brand">{inr(m.price)}</Text>
            </View>
          ))
        ) : (
          <Text className="text-xs text-muted">No products mapped yet.</Text>
        )}

        {showAddMap ? (
          <View className="p-3 bg-surface border border-line rounded-xl gap-2.5 mt-2">
            <Field label="Principal"><Pills options={PRINCIPALS} value={newPrincipal} onChange={setNewPrincipal} /></Field>
            <Field label="Product Name"><Input value={newProduct} onChangeText={setNewProduct} placeholder="e.g. Tellus S2 MX 46" /></Field>
            <Field label="Agreed Selling Rate ₹"><Input value={newPrice} onChangeText={setNewPrice} placeholder="185" keyboardType="numeric" /></Field>
            <Pressable onPress={handleAddMap} className="self-start bg-brand px-3.5 py-2 rounded-xl mt-1">
              <Text className="text-white font-black text-xs">Save Mapping</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

interface MRow { principal: string; product: string; price: string }

function AddCustomerForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [wa, setWa] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [address, setAddress] = useState('');
  const [terms, setTerms] = useState<string>(PAYMENT_TERMS[2]); // 30 Days Credit
  const [tier, setTier] = useState<Tier>('Silver');
  const [industry, setIndustry] = useState<string>(INDUSTRIES[0]);
  const [area, setArea] = useState<string>(AREAS[0]);
  const [zone, setZone] = useState<PayZone>('Green Zone');
  const [outstanding, setOutstanding] = useState('');
  const [rows, setRows] = useState<MRow[]>([{ principal: PRINCIPALS[0], product: '', price: '' }]);
  const [err, setErr] = useState('');

  const setRow = (i: number, patch: Partial<MRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!name.trim()) { setErr('Enter the customer name'); return; }
    const mappings = rows.filter((r) => r.product.trim()).map((r) => ({ principal: r.principal, product: r.product.trim(), price: +r.price || 0 }));
    actions.addCustomer({
      name: name.trim(),
      contactName: contact.trim(),
      phone: phone.trim(),
      whatsapp: sameAsMobile ? phone.trim() : wa.trim(),
      sameAsMobile,
      address: address.trim(),
      paymentTerms: terms,
      tier,
      industry,
      area,
      payZone: zone,
      outstanding: outstanding === '' ? 0 : +outstanding,
      division: 'LUB',
      mappings,
    });
    onDone();
  };

  return (
    <View className="gap-3">
      <Field label="Customer Account Name"><Input value={name} onChangeText={setName} placeholder="Company name" /></Field>
      <Field label="Contact Person"><Input value={contact} onChangeText={setContact} placeholder="e.g. Ganesh Kumar" /></Field>
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
        {!sameAsMobile ? <Input value={wa} onChangeText={setWa} placeholder="WhatsApp number" keyboardType="phone-pad" /> : null}
      </View>

      <Field label="Agreed Payment Terms">
        <Pills options={PAYMENT_TERMS} value={terms} onChange={setTerms} />
      </Field>

      <Field label="Street / Unit Address"><Input value={address} onChangeText={setAddress} placeholder="Street, area or unit" /></Field>
      <Field label="Account Tier"><Pills options={TIERS} value={tier} onChange={setTier} /></Field>
      <Field label="Industry Sector"><Pills options={INDUSTRIES} value={industry} onChange={setIndustry} /></Field>
      <Field label="Industrial Area"><Pills options={AREAS} value={area} onChange={setArea} /></Field>
      <Field label="Initial Pay Zone"><Pills options={PAY_ZONES} value={zone} onChange={setZone} /></Field>
      <Field label="Opening Outstanding ₹"><Input value={outstanding} onChangeText={setOutstanding} placeholder="0" keyboardType="numeric" /></Field>

      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">Principal & Sub-Product Mappings</Text>
        {rows.map((r, i) => (
          <View key={i} className="bg-surface border border-line rounded-xl p-3 gap-2">
            <Pills options={PRINCIPALS} value={r.principal} onChange={(v) => setRow(i, { principal: v })} />
            <View className="flex-row gap-2 items-center">
              <View className="flex-[2]"><Input value={r.product} onChangeText={(t) => setRow(i, { product: t })} placeholder="Sub product" /></View>
              <View className="flex-1"><Input value={r.price} onChangeText={(t) => setRow(i, { price: t })} placeholder="₹ price" keyboardType="numeric" /></View>
              {rows.length > 1 ? <Pressable onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))} hitSlop={8}><Text className="text-danger font-bold text-base">✕</Text></Pressable> : null}
            </View>
          </View>
        ))}
        <Pressable onPress={() => setRows((rs) => [...rs, { principal: PRINCIPALS[0], product: '', price: '' }])} className="self-start px-3.5 py-2 rounded-xl border border-line bg-surface">
          <Text className="text-xs font-black text-ink2">+ Add Product Mapping</Text>
        </Pressable>
      </View>

      {err ? <Text className="text-xs text-danger font-bold">{err}</Text> : null}
      <View className="flex-row gap-2 mt-1">
        <ModalBtn label="Cancel" variant="ghost" onPress={onDone} />
        <ModalBtn label="Create Customer" onPress={submit} />
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
