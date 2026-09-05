import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Badge, Chip, Empty, KpiStrip } from '@/gs/kit';
import { Sheet, Field, Input, Pills, ModalBtn } from '@/gs/modal';
import { C } from '@/gs/theme';
import { useDebounced } from '@/gs/useDebounced';
import { useIndustries } from '@/gs/queries/catalog';
import { useAuthUser } from '@/gs/auth';
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, type LeadRow } from '@/gs/queries/leads';
import { DeleteButton } from '@/gs/DeleteButton';
import {
  inr, shortDate, agingDays, dealTone, tierTone, DEAL_STAGE_VALUES, DEAL_STAGE_LABELS, TIERS, AREAS, type DealStageValue,
} from '@/gs/domain';
import { SearchIcon, TargetIcon } from '@/gs/icons';

export default function Leads() {
  const user = useAuthUser();
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounced(searchText, 300);
  // Kanban groups by stage, so a partially loaded list shows incomplete
  // columns — fetch every page of the FILTERED set, same as the web board.
  const {
    items: leads,
    total,
    isLoadingAll: isLoading,
    refetch,
  } = useLeads(
    { search: debouncedSearch.trim() || undefined },
    { autoFetchAll: true },
  );
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const [mode, setMode] = useState<'list' | 'kanban'>('list');
  const [stage, setStage] = useState<string>('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => leads.filter((l: LeadRow) => {
    if (stage !== 'ALL' && l.stage !== stage) return false;
    return true;
  }), [leads, stage]);

  const stagesWithCounts = useMemo(
    () => DEAL_STAGE_VALUES.map((s) => ({ stage: s, label: DEAL_STAGE_LABELS[s], count: leads.filter((l: LeadRow) => l.stage === s).length })).filter((x) => x.count > 0),
    [leads],
  );
  const pipeline = leads.filter((l: LeadRow) => !['ClosedLost', 'NoRequirementOrCold'].includes(l.stage)).reduce((s, l) => s + l.totalValue, 0);
  const wonValue = leads.filter((l: LeadRow) => l.stage === 'ClosedWon').reduce((s, l) => s + l.totalValue, 0);
  const oralCount = leads.filter((l: LeadRow) => l.stage === 'NegotiationOralConfirmation').length;
  const openCount = leads.filter((l: LeadRow) => !['ClosedWon', 'ClosedLost', 'NoRequirementOrCold'].includes(l.stage)).length;
  const detail = leads.find((l: LeadRow) => l.id === detailId) || null;

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
            <TextInput value={searchText} onChangeText={setSearchText} placeholder="Search prospects or contact…" placeholderTextColor={C.faint}
              className="flex-1 ml-2 text-[13px] text-ink font-medium" autoCapitalize="none" />
            {searchText ? <Pressable onPress={() => setSearchText('')} hitSlop={8}><Text className="text-muted font-bold text-sm">x</Text></Pressable> : null}
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
              <Chip key={x.stage} label={x.label || x.stage} count={x.count} active={stage === x.stage} onPress={() => setStage(x.stage)} />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#10b981" />
        </View>
      ) : mode === 'list' ? (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          contentContainerClassName="p-4 pb-28 gap-2.5"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <LeadCard l={item} onPress={() => setDetailId(item.id)} />}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={<Empty text="No deals match the selected criteria." />}
          onRefresh={refetch}
          refreshing={false}
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="p-4 pb-28">
          <Kanban leads={filtered} onOpen={setDetailId} />
        </ScrollView>
      )}

      {/* Add Lead Modal */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add new sales customer" subtitle="Logs a prospect into the pipeline">
        <AddLeadForm
          salespersonId={user?.userId || ''}
          onCreate={async (b) => { await createLead.mutateAsync(b); }}
          onDone={() => { setShowAdd(false); refetch(); }}
        />
      </Sheet>

      {/* Lead Detail Sheet */}
      <Sheet
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail?.customerName || ''}
        subtitle={detail ? `${detail.industryName ?? ''} · ${inr(detail.totalValue)}` : ''}
        footer={
          <>
            {detail ? (
              <DeleteButton
                label="Delete"
                title={`Delete ${detail.customerName}?`}
                body="The deal and its line items are removed. To keep it for reporting, move the stage to Closed Lost instead."
                onDelete={() => deleteLead.mutateAsync(detail.id)}
                onDeleted={() => setDetailId(null)}
              />
            ) : null}
            <ModalBtn label="Close" variant="ghost" onPress={() => setDetailId(null)} />
          </>
        }
      >
        {detail ? (
          <LeadDetail
            l={detail}
            onUpdate={(patch) => {
              updateLead.mutate({ id: detail.id, patch });
            }}
          />
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

function LeadCard({ l, onPress }: { l: LeadRow; onPress: () => void }) {
  const inStage = agingDays(l.stageUpdatedAt || l.createdAt);
  const stale = inStage != null && inStage > 14;

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-[14px] font-black text-ink">{l.customerName}</Text>
          <Text className="text-xs text-muted font-medium mt-0.5">
            {l.contactName ? `${l.contactName} · ` : ''}{l.area ?? 'Area unassigned'}
          </Text>
          {l.industryName ? (
            <Text className="text-[11px] text-muted font-semibold mt-0.5">
              {l.industryName} · <Text className="text-ink2">{l.subIndustry}</Text>
            </Text>
          ) : null}
        </View>
        <Badge label={l.tier ?? '—'} tone={tierTone(l.tier || '')} small />
      </View>

      {/* Stage Badge & Deal Value */}
      <View className="flex-row items-center justify-between mt-3 mb-1 bg-surface3/60 rounded-xl p-2.5">
        <Badge label={DEAL_STAGE_LABELS[l.stage] || l.stage} tone={dealTone(l.stage)} small showDot />
        <Text className="text-[16px] font-black text-brand">{inr(l.totalValue)}</Text>
      </View>

      {/* Timelines */}
      <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-line/80">
        <Text className={`text-[11px] font-bold ${stale ? 'text-amber-dark' : 'text-muted'}`}>
          {inStage ?? 0}d in stage{stale ? ' · Stale' : ''}
        </Text>
        <Text className="text-[11px] text-muted font-bold">
          Next: <Text className="text-ink">{shortDate(l.nextFollowUp)}</Text>
        </Text>
      </View>
    </Card>
  );
}

function Kanban({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 12 }}>
      {DEAL_STAGE_VALUES.map((st) => {
        const items = leads.filter((l: LeadRow) => l.stage === st);
        const total = items.reduce((s, l: LeadRow) => s + l.totalValue, 0);
        return (
          <View key={st} className="w-68 bg-surface3/50 rounded-2xl border border-line p-3 gap-2.5">
            <View className="px-1 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-[12px] font-black text-ink" numberOfLines={1}>{DEAL_STAGE_LABELS[st] || st}</Text>
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
                  <Text className="text-[13px] font-black text-ink">{l.customerName}</Text>
                  <Text className="text-[10px] text-muted font-medium">{l.contactName} · {l.area}</Text>
                  <Text className="text-[13px] font-black text-brand mt-1">{inr(l.totalValue)}</Text>
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

import type { LeadUpdate } from '@/gs/queries/leads';

function LeadDetail({ l, onUpdate }: { l: LeadRow; onUpdate: (patch: LeadUpdate) => void }) {
  const [next, setNext] = useState(l.nextFollowUp || '');
  const [expClose, setExpClose] = useState(l.expClose || '');

  return (
    <View className="gap-4">
      {/* Overview Info */}
      <View className="flex-row flex-wrap gap-y-3 bg-surface3/60 rounded-xl p-3">
        <Info label="Industry" value={`${l.industryName ?? ''}${l.subIndustry ? ` · ${l.subIndustry}` : ''}`} />
        <Info label="Area & Address" value={`${l.area ?? ''}${l.address ? `, ${l.address}` : ''}`} />
        <Info label="Phone / WhatsApp" value={`${l.phone ?? ''}${l.whatsapp && l.whatsapp !== l.phone ? ` / ${l.whatsapp}` : ''}`} />
        <Info label="Pipeline Value" value={inr(l.totalValue)} strong />
      </View>

      <Field label="Move to Deal Stage">
        <Pills options={DEAL_STAGE_VALUES as unknown as string[]} value={l.stage} onChange={(s) => onUpdate({ stage: s as DealStageValue })} />
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
          onPress={() => onUpdate({ nextFollowUp: next || null, expClose: expClose || null })}
          className="self-start bg-brand-soft px-3.5 py-1.5 rounded-lg mt-1"
        >
          <Text className="text-brand-dark font-black text-xs">Save Dates</Text>
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

import type { LeadCreate } from '@/gs/queries/leads';

function AddLeadForm({ salespersonId, onCreate, onDone }: {
  salespersonId: string;
  onCreate: (body: LeadCreate) => Promise<void>;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [wa, setWa] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [address, setAddress] = useState('');
  // Industry comes from the catalogue, and is now actually SENT: the form
  // collected it and the submit body below simply left both fields out, so
  // every lead created on mobile arrived with no industry at all.
  const { data: industries = [] } = useIndustries();
  const [industryId, setIndustryId] = useState<string>('');
  const [subIndustry, setSubIndustry] = useState<string>('');
  const [area, setArea] = useState<string>(AREAS[0]);
  const [stage, setStage] = useState<DealStageValue>('NewEnquiries');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedIndustry = industries.find((i) => i.id === industryId);
  const subOptions = selectedIndustry?.subIndustries ?? [];

  const submit = async () => {
    if (!name.trim()) { setErr('Enter the customer name'); return; }
    setErr('');
    setSaving(true);
    try {
      await onCreate({
        customerName: name.trim(),
        salespersonId,
        contactName: contact.trim() || null,
        phone: phone.trim() || null,
        whatsapp: sameAsMobile ? phone.trim() || null : wa.trim() || null,
        sameAsMobile,
        address: address.trim() || null,
        area: area || null,
        industryId: industryId || null,
        subIndustry: subIndustry || null,
        stage,
      });
      setSaved(true);
      setTimeout(() => onDone(), 700);
    } catch {
      setErr('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
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

      {/* Cascading Industry */}
      <Field label="Industry Sector">
        <Pills
          options={industries.map((i) => i.name)}
          value={selectedIndustry?.name ?? ''}
          onChange={(name) => {
            const picked = industries.find((i) => i.name === name);
            setIndustryId(picked?.id ?? '');
            // The old sub-industry belongs to the old industry.
            setSubIndustry(picked?.subIndustries?.[0] ?? '');
          }}
        />
      </Field>
      {subOptions.length > 0 ? (
        <Field label={`Sub-industry Sector (${selectedIndustry?.name ?? ''})`}>
          <Pills options={subOptions} value={subIndustry} onChange={setSubIndustry} />
        </Field>
      ) : null}
      <Field label="Industrial Area"><Pills options={AREAS} value={area} onChange={setArea} /></Field>
      <Field label="Initial Deal Stage"><Pills options={DEAL_STAGE_VALUES as unknown as string[]} value={stage} onChange={(v) => setStage(v as DealStageValue)} /></Field>

      {err ? <Text className="text-xs text-danger font-bold">{err}</Text> : null}
      {saved ? (
        <View className="bg-brand-soft border border-brand-border/60 rounded-xl py-3 items-center">
          <Text className="text-brand-dark font-black text-sm">Prospect added to pipeline!</Text>
        </View>
      ) : (
        <View className="flex-row gap-2 mt-1">
          <ModalBtn label="Cancel" variant="ghost" onPress={onDone} />
          <ModalBtn label={saving ? 'Saving…' : 'Save Sales Prospect'} onPress={saving ? () => {} : () => { void submit(); }} />
        </View>
      )}
    </View>
  );
}
