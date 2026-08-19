import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, Chip, Empty, KpiStrip } from '@/gs/kit';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { C } from '@/gs/theme';
import { useStore, actions, LeadX } from '@/gs/store';
import {
  inr, shortDate, agingDays, dealTone, tierTone, DEAL_STAGES, TIERS, INDUSTRIES, INDUSTRY_TAXONOMY, AREAS, PRINCIPALS,
  type DealStage, type Tier,
} from '@/gs/domain';
import { SearchIcon, TargetIcon } from '@/gs/icons';

export default function Leads() {
  const leads = useStore((s) => s.leads);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'list' | 'kanban'>('list');
  const [stage, setStage] = useState<string>('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => leads.filter((l) => {
    if (stage !== 'ALL' && l.stage !== stage) return false;
    if (q && !l.name.toLowerCase().includes(q.toLowerCase()) && !(l.contactName || '').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [leads, q, stage]);

  const stagesWithCounts = useMemo(
    () => DEAL_STAGES.map((s) => ({ stage: s, count: leads.filter((l) => l.stage === s).length })).filter((x) => x.count > 0),
    [leads],
  );
  const pipeline = leads.filter((l) => !['Closed Lost', 'No Requirement or Cold'].includes(l.stage)).reduce((s, l) => s + l.value, 0);
  const wonValue = leads.filter((l) => l.stage === 'Closed Won').reduce((s, l) => s + l.value, 0);
  const oralCount = leads.filter((l) => l.stage === 'Negotiation / Oral Confirmation').length;
  const openCount = leads.filter((l) => !['Closed Won', 'Closed Lost', 'No Requirement or Cold'].includes(l.stage)).length;
  const detail = leads.find((l) => l.id === detailId) || null;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Sticky Zones 1-3 */}
      <View className="bg-canvas border-b border-line/50 px-4 pt-2 pb-0 gap-1">
        {/* Zone 1 */}
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Text className="text-[20px] font-black text-ink tracking-tight">New Sales Pipeline</Text>
          </View>
          <Pressable onPress={() => setShowAdd(true)} className="bg-brand px-3.5 py-2 rounded-xl shadow-sm">
            <Text className="text-white font-black text-xs">+ Prospect</Text>
          </Pressable>
        </View>
        {/* Zone 2 — Pipeline KPI Strip */}
        <View className="mb-1.5">
          <KpiStrip items={[
            { label: 'Active Pipeline', value: inr(pipeline), accent: pipeline > 0 },
            { label: 'Won', value: inr(wonValue) },
            { label: 'Open Deals', value: String(openCount) },
            { label: 'At Oral', value: String(oralCount), alert: oralCount > 0 },
          ]} />
        </View>
        {/* Zone 3 — Search + View Switcher + Stage Chips */}
        <View className="gap-2 pb-2">
          <View className="flex-row items-center bg-surface border border-line rounded-xl px-3 py-2.5">
            <SearchIcon size={16} color="#64748b" />
            <TextInput value={q} onChangeText={setQ} placeholder="Search prospects or contact…" placeholderTextColor={C.faint}
              className="flex-1 ml-2 text-[13px] text-ink font-medium" autoCapitalize="none" />
            {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Text className="text-muted font-bold text-sm">x</Text></Pressable> : null}
          </View>
          <View className="flex-row gap-2 p-1 bg-surface3 rounded-xl">
            <Pressable onPress={() => setMode('list')} className={`flex-1 py-1.5 rounded-lg items-center ${mode === 'list' ? 'bg-surface shadow-sm' : ''}`}>
              <Text className={`text-xs font-extrabold ${mode === 'list' ? 'text-ink' : 'text-muted'}`}>List View ({filtered.length})</Text>
            </Pressable>
            <Pressable onPress={() => setMode('kanban')} className={`flex-1 py-1.5 rounded-lg items-center ${mode === 'kanban' ? 'bg-surface shadow-sm' : ''}`}>
              <Text className={`text-xs font-extrabold ${mode === 'kanban' ? 'text-ink' : 'text-muted'}`}>Kanban Board</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            <Chip key="ALL" label="All" count={leads.length} active={stage === 'ALL'} onPress={() => setStage('ALL')} />
            {stagesWithCounts.map((x) => (
              <Chip key={x.stage} label={x.stage} count={x.count} active={stage === x.stage} onPress={() => setStage(x.stage)} />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Zone 4 — Content */}
      {mode === 'list' ? (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          contentContainerClassName="p-4 pb-28 gap-2.5"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <LeadCard l={item} onPress={() => setDetailId(item.id)} />}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={<Empty text="No deals match the selected criteria." />}
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28">
          <Kanban leads={filtered} onOpen={setDetailId} />
        </ScrollView>
      )}

      {/* Add Lead Modal */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add new sales customer" subtitle="Logs a prospect into the pipeline">
        <AddLeadForm onDone={() => setShowAdd(false)} />
      </Sheet>

      {/* Lead Detail Sheet */}
      <Sheet open={!!detail} onClose={() => setDetailId(null)} title={detail?.name || ''} subtitle={detail ? `${detail.contactName} · ${detail.phone}` : ''}
        footer={<ModalBtn label="Close" variant="ghost" onPress={() => setDetailId(null)} />}>
        {detail ? <LeadDetail l={detail} /> : null}
      </Sheet>
    </SafeAreaView>
  );
}

function LeadCard({ l, onPress }: { l: LeadX; onPress: () => void }) {
  const inStage = agingDays(l.stageUpdatedAt);
  const stale = (inStage ?? 0) > 14;

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-[14px] font-black text-ink">{l.name}</Text>
          <Text className="text-[11px] text-muted font-medium mt-0.5">
            {l.contactName} · {l.area}
          </Text>
          {l.subIndustry ? (
            <Text className="text-[10px] text-muted font-bold mt-0.5">
              {l.industry} · <Text className="text-ink2">{l.subIndustry}</Text>
            </Text>
          ) : null}
        </View>
        <Badge label={l.tier} tone={tierTone(l.tier)} small />
      </View>

      {/* Stage Badge & Deal Value */}
      <View className="flex-row items-center justify-between mt-3 mb-1 bg-surface3/60 rounded-xl p-2.5">
        <Badge label={l.stage} tone={dealTone(l.stage)} small showDot />
        <Text className="text-[16px] font-black text-brand">{inr(l.value)}</Text>
      </View>

      {/* Timelines & Follow-ups */}
      <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-line/80">
        <Text className={`text-[11px] font-bold ${stale ? 'text-amber-dark' : 'text-muted'}`}>
          {inStage ?? 0}d in stage{stale ? ' · Stale' : ''}
          {l.remarks.length ? ` · ${l.remarks.length} remark${l.remarks.length > 1 ? 's' : ''}` : ''}
        </Text>
        <Text className="text-[11px] text-muted font-bold">
          Next: <Text className="text-ink">{shortDate(l.nextFollowUp)}</Text>
        </Text>
      </View>
    </Card>
  );
}

function Kanban({ leads, onOpen }: { leads: LeadX[]; onOpen: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 12 }}>
      {DEAL_STAGES.map((st) => {
        const items = leads.filter((l) => l.stage === st);
        const total = items.reduce((s, l) => s + l.value, 0);
        return (
          <View key={st} className="w-68 bg-surface3/50 rounded-2xl border border-line p-3 gap-2.5">
            <View className="px-1 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-[12px] font-black text-ink" numberOfLines={1}>{st}</Text>
                <Text className="text-[11px] text-brand font-bold mt-0.5">{inr(total)}</Text>
              </View>
              <View className="bg-surface px-2 py-0.5 rounded-full border border-line">
                <Text className="text-[10px] font-bold text-muted">{items.length}</Text>
              </View>
            </View>
            {items.length ? (
              items.map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => onOpen(l.id)}
                  className="bg-surface rounded-xl border border-line/80 p-3 shadow-sm gap-1"
                >
                  <Text className="text-[13px] font-black text-ink">{l.name}</Text>
                  <Text className="text-[10px] text-muted font-medium">{l.contactName} · {l.area}</Text>
                  <Text className="text-[13px] font-black text-brand mt-1">{inr(l.value)}</Text>
                </Pressable>
              ))
            ) : (
              <Text className="text-[11px] text-muted font-medium px-2 py-3">No deals in this stage</Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function LeadDetail({ l }: { l: LeadX }) {
  const [next, setNext] = useState(l.nextFollowUp || '');
  const [expClose, setExpClose] = useState(l.expClose || '');
  const [remark, setRemark] = useState('');

  return (
    <View className="gap-4">
      {/* Overview Info */}
      <View className="flex-row flex-wrap gap-y-3 bg-surface3/60 rounded-xl p-3">
        <Info label="Industry" value={`${l.industry}${l.subIndustry ? ` · ${l.subIndustry}` : ''}`} />
        <Info label="Area & Address" value={`${l.area}${l.address ? `, ${l.address}` : ''}`} />
        <Info label="Phone / WhatsApp" value={`${l.phone}${l.whatsapp && l.whatsapp !== l.phone ? ` / ${l.whatsapp}` : ''}`} />
        <Info label="Pipeline Value" value={inr(l.value)} strong />
      </View>

      <Field label="Move to Deal Stage">
        <Pills options={DEAL_STAGES} value={l.stage} onChange={(s) => actions.moveLeadStage(l.id, s as DealStage)} />
      </Field>

      {/* Date Targets */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">Target Milestones</Text>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Field label="Next follow-up date">
              <Input value={next} onChangeText={setNext} placeholder="YYYY-MM-DD" />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Expected close date">
              <Input value={expClose} onChangeText={setExpClose} placeholder="YYYY-MM-DD" />
            </Field>
          </View>
        </View>
        <Pressable
          onPress={() => actions.updateLead(l.id, { nextFollowUp: next || null, expClose: expClose || null })}
          className="self-start bg-brand-soft px-3.5 py-1.5 rounded-lg mt-1"
        >
          <Text className="text-brand-dark font-black text-xs">Save Dates</Text>
        </Pressable>
      </View>

      {/* Remarks */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">Remarks Timeline ({l.remarks.length})</Text>
        {l.remarks.length === 0 ? (
          <Text className="text-xs text-muted">No remarks recorded yet.</Text>
        ) : (
          l.remarks.map((r, i) => (
            <View key={i} className="bg-surface rounded-xl border border-line p-3">
              <Text className="text-xs text-ink font-medium">{r.text}</Text>
              <Text className="text-[10px] text-muted font-bold mt-1">
                {r.by} · {shortDate(r.at.slice(0, 10))}
              </Text>
            </View>
          ))
        )}
        <Input value={remark} onChangeText={setRemark} placeholder="Add a remark…" multiline />
        <Pressable
          onPress={() => {
            if (remark.trim()) {
              actions.addLeadRemark(l.id, remark.trim());
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

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="w-1/2 gap-0.5">
      <Text className="text-[10px] text-muted font-extrabold uppercase">{label}</Text>
      <Text className={`text-[13px] ${strong ? 'text-brand font-black' : 'text-ink font-bold'}`}>{value}</Text>
    </View>
  );
}

interface PRow { principal: string; name: string; value: string }

function AddLeadForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [wa, setWa] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [address, setAddress] = useState('');
  const [tier, setTier] = useState<Tier>('Silver');
  const [industry, setIndustry] = useState<string>(INDUSTRIES[0]);
  const [subIndustry, setSubIndustry] = useState<string>(INDUSTRY_TAXONOMY[INDUSTRIES[0]]?.[0] || '');
  const [area, setArea] = useState<string>(AREAS[0]);
  const [stage, setStage] = useState<DealStage>('New Enquiries');
  const [rows, setRows] = useState<PRow[]>([{ principal: PRINCIPALS[0], name: '', value: '' }]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const subOptions = INDUSTRY_TAXONOMY[industry] || [];

  const setRow = (i: number, patch: Partial<PRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const total = rows.reduce((s, r) => s + (+r.value || 0), 0);

  const submit = () => {
    if (!name.trim()) { setErr('Enter the customer name'); return; }
    const products = rows.filter((r) => r.name.trim()).map((r) => ({ name: `${r.principal} · ${r.name.trim()}`, value: +r.value || 0 }));
    setSaving(true);
    setTimeout(() => {
      actions.addLead({
        name: name.trim(),
        contactName: contact.trim(),
        phone: phone.trim(),
        whatsapp: sameAsMobile ? phone.trim() : wa.trim(),
        sameAsMobile,
        address: address.trim(),
        tier,
        industry,
        subIndustry,
        area,
        stage,
        value: total,
        nextFollowUp: null,
        expClose: null,
        products,
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => onDone(), 700);
    }, 400);
  };

  return (
    <View className="gap-3">
      <Field label="Customer / Account Name"><Input value={name} onChangeText={setName} placeholder="Company name" /></Field>
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

      <Field label="Unit / Street Address"><Input value={address} onChangeText={setAddress} placeholder="Address details" /></Field>
      <Field label="Account Tier"><Pills options={TIERS} value={tier} onChange={setTier} /></Field>

      {/* Cascading Industry and Sub-industry */}
      <Field label="Industry Sector">
        <Pills
          options={INDUSTRIES}
          value={industry}
          onChange={(ind) => {
            setIndustry(ind);
            setSubIndustry(INDUSTRY_TAXONOMY[ind]?.[0] || '');
          }}
        />
      </Field>

      {subOptions.length > 0 ? (
        <Field label={`Sub-industry Sector (${industry})`}>
          <Pills options={subOptions} value={subIndustry} onChange={setSubIndustry} />
        </Field>
      ) : null}

      <Field label="Industrial Area"><Pills options={AREAS} value={area} onChange={setArea} /></Field>
      <Field label="Initial Deal Stage"><Pills options={DEAL_STAGES} value={stage} onChange={setStage} /></Field>

      {/* Multi-product row builder */}
      <View className="gap-2 border-t border-line pt-3">
        <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">
          Products & Expected Pipeline ({inr(total)})
        </Text>
        {rows.map((r, i) => (
          <View key={i} className="bg-surface border border-line rounded-xl p-3 gap-2">
            <Pills options={PRINCIPALS} value={r.principal} onChange={(v) => setRow(i, { principal: v })} />
            <View className="flex-row gap-2 items-center">
              <View className="flex-[2]"><Input value={r.name} onChangeText={(t) => setRow(i, { name: t })} placeholder="Product name" /></View>
              <View className="flex-1"><Input value={r.value} onChangeText={(t) => setRow(i, { value: t })} placeholder="₹ value" keyboardType="numeric" /></View>
              {rows.length > 1 ? (
                <Pressable onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))} hitSlop={8}>
                  <Text className="text-danger font-bold text-base">✕</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
        <Pressable onPress={() => setRows((rs) => [...rs, { principal: PRINCIPALS[0], name: '', value: '' }])} className="self-start px-3.5 py-2 rounded-xl border border-line bg-surface">
          <Text className="text-xs font-black text-ink2">+ Add Product Line</Text>
        </Pressable>
      </View>

      {err ? <Text className="text-xs text-danger font-bold">{err}</Text> : null}
      {saved ? (
        <View className="bg-brand-soft border border-brand-border/60 rounded-xl py-3 items-center">
          <Text className="text-brand-dark font-black text-sm">Prospect added to pipeline!</Text>
        </View>
      ) : (
        <View className="flex-row gap-2 mt-1">
          <ModalBtn label="Cancel" variant="ghost" onPress={onDone} />
          <ModalBtn label={saving ? 'Saving…' : 'Save Sales Prospect'} onPress={saving ? () => {} : submit} />
        </View>
      )}
    </View>
  );
}
