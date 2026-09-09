import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Badge, Card, Empty, KpiStrip, ListFooter } from '@/gs/kit';
import { Field, Input, ModalBtn, Sheet } from '@/gs/modal';
import { DeleteButton } from '@/gs/DeleteButton';
import { useDebounced } from '@/gs/useDebounced';
import { inr, lakhs } from '@/gs/domain';
import { SearchIcon, PlusIcon } from '@/gs/icons';
import { useCustomers } from '@/gs/queries/customers';
import {
  useMappings,
  useProducts,
  useCreateMapping,
  useUpdateMapping,
  useDeleteMapping,
  type MappingRow,
} from '@/gs/queries/catalog';

/**
 * Customer x product mappings — which products an account buys, and at what
 * agreed price.
 *
 * Web has had this surface since the catalog shipped, and a sales user sees it
 * there as "My Customer Mapping". Mobile had the list query and the create
 * mutation sitting in `queries/catalog.ts` with no screen rendering either, so
 * on a phone the projections worksheet could only ever show rows that arrived
 * with the seed.
 *
 * The customer/product pair is immutable server-side, so editing here means the
 * agreed price and nothing else. Changing which product an account buys is a
 * delete and a re-create.
 */
export default function Mappings() {
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q, 300);

  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');

  const {
    items: mappings,
    total,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMappings({ search: debouncedQ.trim() || undefined });

  const update = useUpdateMapping();
  const del = useDeleteMapping();

  const selected = mappings.find((m) => m.id === selectedId) ?? null;
  const overrides = mappings.filter((m) => m.customPrice != null).length;
  const bookValue = mappings.reduce((s, m) => s + (m.effectivePrice ?? 0), 0);

  const openRow = (m: MappingRow) => {
    setSelectedId(m.id);
    // Prefill with the override only. Showing the catalog price in this field
    // would let a user "keep" it by saving, which silently converts an
    // inherited price into a frozen one.
    setPriceDraft(m.customPrice == null ? '' : String(m.customPrice));
  };

  const savePrice = async () => {
    if (!selected || update.isPending) return;
    const trimmed = priceDraft.trim();
    // An emptied field means "go back to the catalog price", which is null.
    // Zero is not the same thing — that is a real agreed price of nothing.
    const customPrice = trimmed === '' ? null : Number(trimmed);
    if (customPrice != null && !Number.isFinite(customPrice)) return;
    await update.mutateAsync({ id: selected.id, body: { customPrice } });
    setSelectedId(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="bg-canvas border-b border-line/50 px-4 pt-2 pb-0 gap-1">
        <View className="flex-row items-center justify-between py-1">
          <View className="flex-1">
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="flex-row items-center gap-0.5 mb-0.5"
            >
              <Text className="text-brand font-black text-xs">‹ Back</Text>
            </Pressable>
            <Text className="text-[20px] font-black text-ink tracking-tight">My Customer Mapping</Text>
            <Text className="text-[11px] text-muted font-medium mt-0.5">
              What each account buys, and the price it buys at
            </Text>
          </View>
          <Pressable
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            accessibilityLabel="Map a product to a customer"
            className="w-11 h-11 rounded-2xl bg-brand items-center justify-center shadow-sm"
          >
            <PlusIcon size={20} color="#ffffff" />
          </Pressable>
        </View>

        <KpiStrip
          items={[
            { label: 'Mapped', value: String(total) },
            { label: 'Agreed price', value: String(overrides), accent: overrides > 0 },
            { label: 'Line value', value: lakhs(bookValue) },
          ]}
        />

        <View className="flex-row items-center gap-2 border border-line rounded-xl bg-surface px-3 my-2">
          <SearchIcon size={16} color="#64748b" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search customer, product or SKU..."
            placeholderTextColor="#94a3b8"
            accessibilityLabel="Search mappings"
            className="flex-1 py-3 text-[13px] text-ink font-medium"
          />
        </View>
      </View>

      <FlatList
        data={mappings}
        keyExtractor={(m) => m.id}
        contentContainerClassName="p-4 pb-28 gap-2.5"
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={() => void refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        ListEmptyComponent={
          isLoading ? null : (
            <Empty
              text={
                debouncedQ.trim()
                  ? 'No mappings match your search.'
                  : 'Nothing mapped yet. Map a product to a customer to start projecting it.'
              }
              actionLabel="Map a product"
              onAction={() => setShowAdd(true)}
            />
          )
        }
        ListFooterComponent={
          <ListFooter shown={mappings.length} total={total} loading={isFetchingNextPage} />
        }
        renderItem={({ item: m }) => (
          <Card onPress={() => openRow(m)}>
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <Text className="text-[14px] font-black text-ink" numberOfLines={1}>
                  {m.customerName}
                </Text>
                <Text className="text-[12px] text-body font-semibold mt-0.5" numberOfLines={1}>
                  {m.productName}
                </Text>
                {m.productSku ? (
                  <Text className="text-[10px] text-faint font-bold mt-0.5">{m.productSku}</Text>
                ) : null}
                <Text className="text-[11px] text-muted font-medium mt-1" numberOfLines={1}>
                  {m.principalName} · {m.salespersonName}
                </Text>
              </View>
              <View className="items-end gap-1">
                {/* effectivePrice comes straight from the server. Recomputing it
                    here is how two surfaces end up disagreeing about what a
                    customer pays. */}
                <Text className="text-[15px] font-black text-ink tabular-nums">
                  {m.effectivePrice == null ? '—' : inr(m.effectivePrice)}
                </Text>
                {m.customPrice == null ? (
                  <Text className="text-[10px] text-faint font-bold">Catalog price</Text>
                ) : (
                  <Badge label="Agreed" tone="won" small />
                )}
              </View>
            </View>
          </Card>
        )}
      />

      <Sheet
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={selected?.productName ?? 'Mapping'}
        subtitle={selected ? `Mapped to ${selected.customerName}` : undefined}
        footer={
          selected ? (
            <View className="flex-row gap-2.5">
              <DeleteButton
                label="Unmap"
                title="Remove this mapping?"
                body={`${selected.productName} will no longer be projectable for ${selected.customerName}. The server refuses while projection lines still resolve through it.`}
                onDelete={() => del.mutateAsync(selected.id)}
                onDeleted={() => setSelectedId(null)}
              />
              <ModalBtn
                label={update.isPending ? 'Saving...' : 'Save price'}
                onPress={() => void savePrice()}
                disabled={update.isPending}
              />
            </View>
          ) : undefined
        }
      >
        {selected ? (
          <View className="gap-4">
            <View className="gap-2">
              <DetailRow label="Customer" value={selected.customerName} />
              <DetailRow label="Principal" value={selected.principalName} />
              <DetailRow label="SKU" value={selected.productSku ?? '—'} />
              <DetailRow label="Salesperson" value={selected.salespersonName} />
              <DetailRow
                label="Catalog price"
                value={selected.basePrice == null ? '—' : inr(selected.basePrice)}
              />
              <DetailRow
                label="Effective price"
                value={selected.effectivePrice == null ? '—' : inr(selected.effectivePrice)}
                strong
              />
            </View>
            <Field label="Agreed price (blank = catalog price)">
              <Input
                value={priceDraft}
                onChangeText={setPriceDraft}
                placeholder={
                  selected.basePrice == null ? 'No catalog price' : String(selected.basePrice)
                }
                keyboardType="numeric"
              />
            </Field>
          </View>
        ) : null}
      </Sheet>

      <AddMappingSheet open={showAdd} onClose={() => setShowAdd(false)} />
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-[11px] text-muted font-bold uppercase tracking-wide">{label}</Text>
      <Text
        className={`flex-1 text-right text-[13px] tabular-nums ${strong ? 'font-black text-ink' : 'font-semibold text-body'}`}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Create sheet.
 *
 * The web form pulls every page of customers and products when it opens,
 * because its pickers are plain selects that cannot reach past the first cursor
 * page — it says so in its own comment and calls itself a stopgap. Both
 * endpoints already accept `search`, so these pickers ask the server as you
 * type instead. That is less data on a phone connection and it stays correct
 * at ten thousand customers.
 */
function AddMappingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null);
  const [price, setPrice] = useState('');
  const [custQ, setCustQ] = useState('');
  const [prodQ, setProdQ] = useState('');

  const create = useCreateMapping();

  const debouncedCust = useDebounced(custQ, 300);
  const debouncedProd = useDebounced(prodQ, 300);

  const { items: customers } = useCustomers(
    { search: debouncedCust.trim() || undefined },
    { enabled: open && customer == null },
  );
  const { items: products } = useProducts(
    { search: debouncedProd.trim() || undefined },
    { enabled: open && customer != null && product == null },
  );

  const close = () => {
    setCustomer(null);
    setProduct(null);
    setPrice('');
    setCustQ('');
    setProdQ('');
    onClose();
  };

  const submit = async () => {
    if (!customer || !product || create.isPending) return;
    const trimmed = price.trim();
    const customPrice = trimmed === '' ? null : Number(trimmed);
    if (customPrice != null && !Number.isFinite(customPrice)) return;
    await create.mutateAsync({
      customerId: customer.id,
      productId: product.id,
      customPrice,
    });
    close();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Map a product"
      subtitle="Every projection line resolves its price through a mapping"
      footer={
        <View className="flex-row gap-2.5">
          <ModalBtn label="Cancel" variant="ghost" onPress={close} />
          <ModalBtn
            label={create.isPending ? 'Saving...' : 'Save mapping'}
            onPress={() => void submit()}
            disabled={!customer || !product || create.isPending}
          />
        </View>
      }
    >
      <View className="gap-4">
        <Field label="Customer account">
          {customer ? (
            <Chosen label={customer.name} onClear={() => setCustomer(null)} />
          ) : (
            <Picker
              query={custQ}
              onQuery={setCustQ}
              placeholder="Search customers"
              rows={customers.map((c) => ({ id: c.id, name: c.name, hint: c.area ?? undefined }))}
              onPick={(r) => setCustomer(r)}
            />
          )}
        </Field>

        <Field label="Product / SKU">
          {!customer ? (
            <Text className="text-[11px] text-faint font-semibold">Pick a customer first.</Text>
          ) : product ? (
            <Chosen label={product.name} onClear={() => setProduct(null)} />
          ) : (
            <Picker
              query={prodQ}
              onQuery={setProdQ}
              placeholder="Search products"
              rows={products.map((p) => ({ id: p.id, name: p.name, hint: p.sku ?? undefined }))}
              onPick={(r) => setProduct(r)}
            />
          )}
        </Field>

        <Field label="Agreed price (optional)">
          <Input
            value={price}
            onChangeText={setPrice}
            placeholder="Leave blank to use the catalog price"
            keyboardType="numeric"
          />
        </Field>
      </View>
    </Sheet>
  );
}

function Chosen({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <View className="flex-row items-center justify-between border border-brand-border/60 bg-brand-soft rounded-xl px-3.5 py-3">
      <Text className="flex-1 text-[13px] font-black text-brand-dark" numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        onPress={onClear}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Change ${label}`}
        className="ml-2 px-2 py-1"
      >
        <Text className="text-[11px] font-black text-brand-dark">Change</Text>
      </Pressable>
    </View>
  );
}

function Picker({
  query,
  onQuery,
  placeholder,
  rows,
  onPick,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  rows: { id: string; name: string; hint?: string }[];
  onPick: (row: { id: string; name: string }) => void;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2 border border-line rounded-xl bg-surface px-3">
        <SearchIcon size={16} color="#64748b" />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          accessibilityLabel={placeholder}
          className="flex-1 py-3 text-[13px] text-ink font-medium"
        />
      </View>
      {/* Capped at eight rows: the sheet is already a scroll surface, and a
          second one nested inside it swallows the drag. Typing narrows it. */}
      <View className="border border-line rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <Text className="text-[11px] text-faint font-semibold px-3.5 py-3">No matches.</Text>
        ) : (
          rows.slice(0, 8).map((r, i) => (
            <Pressable
              key={r.id}
              onPress={() => onPick({ id: r.id, name: r.name })}
              accessibilityRole="button"
              accessibilityLabel={r.name}
              className={`px-3.5 py-3 min-h-[48px] justify-center ${i > 0 ? 'border-t border-line/70' : ''}`}
            >
              <Text className="text-[13px] font-bold text-ink" numberOfLines={1}>
                {r.name}
              </Text>
              {r.hint ? (
                <Text className="text-[10px] text-muted font-semibold mt-0.5">{r.hint}</Text>
              ) : null}
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}
