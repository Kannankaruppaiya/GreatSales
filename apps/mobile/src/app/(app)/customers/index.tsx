/**
 * Customers list — search + filters + pull-to-refresh + cursor pagination, with
 * real loading / empty / error states. Reloads on focus so it reflects
 * create/edit/delete done on other screens. What's visible is scoped by the API
 * (own vs. tenant-wide); this screen renders only what it's allowed.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { listCustomers } from '@/lib/api/customers-api';
import {
  CUSTOMER_CATEGORIES,
  PAY_ZONES,
  PAY_ZONE_LABEL,
  PAY_ZONE_TONE,
  type CustomerCategory,
  type CustomerListItem,
  type PayZone,
} from '@/lib/api/customer-types';
import { useTheme } from '@/theme/theme-provider';
import { hitTarget } from '@/theme/tokens';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function Row({ item, onPress }: { item: CustomerListItem; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={({ pressed }) => [
        styles.row,
        { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: pressed ? colors.surfaceSunken : colors.surface },
      ]}
    >
      <View style={styles.rowMain}>
        <Text variant="bodyLg" numberOfLines={1} style={styles.semibold}>
          {item.name}
        </Text>
        <Text variant="bodySm" color="secondary" numberOfLines={1}>
          {item.salespersonName ?? 'Unassigned'}
          {item.area ? ` · ${item.area}` : ''}
        </Text>
        <View style={styles.badges}>
          {item.category ? <Badge label={item.category} tone="neutral" /> : null}
          {item.payZone ? <Badge label={PAY_ZONE_LABEL[item.payZone]} tone={PAY_ZONE_TONE[item.payZone]} /> : null}
        </View>
      </View>
      <View style={styles.rowEnd}>
        <Text variant="caption" color="muted">
          {formatDate(item.createdAt)}
        </Text>
        <Icon name="chevron-forward" size={18} color="textMuted" />
      </View>
    </Pressable>
  );
}

export default function CustomersListScreen() {
  const { colors, spacing, radii } = useTheme();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CustomerCategory | undefined>();
  const [payZone, setPayZone] = useState<PayZone | undefined>();

  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const reqId = useRef(0);
  const filtersActive = Boolean(search || category || payZone);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const id = ++reqId.current;
      if (mode === 'initial') setStatus('loading');
      try {
        const page = await listCustomers({ search: search || undefined, category, payZone, limit: PAGE_SIZE });
        if (id !== reqId.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setStatus('ready');
      } catch {
        if (id !== reqId.current) return;
        setStatus('error');
      }
    },
    [search, category, payZone],
  );

  // Debounce search.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => setSearch(searchInput.trim()), 300);
      return () => clearTimeout(t);
    }, [searchInput]),
  );

  // Load on focus and whenever filters change.
  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load('refresh');
    setRefreshing(false);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listCustomers({ search: search || undefined, category, payZone, cursor: nextCursor, limit: PAGE_SIZE });
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      /* keep current items; user can pull to refresh */
    } finally {
      setLoadingMore(false);
    }
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setCategory(undefined);
    setPayZone(undefined);
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/customers/new')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="New customer"
              style={{ paddingHorizontal: 4 }}
            >
              <Ionicons name="add" size={26} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      {/* Filters */}
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View
          style={[
            styles.search,
            { backgroundColor: colors.inputBg, borderColor: colors.border, borderRadius: radii.md, minHeight: hitTarget },
          ]}
        >
          <Icon name="search" size={18} color="textMuted" />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search customers"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search customers"
          />
          {searchInput ? (
            <Pressable onPress={() => setSearchInput('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="close-circle" size={18} color="textMuted" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.filterRow}>
          <View style={styles.flex}>
            <Select
              label="Category"
              value={category}
              options={CUSTOMER_CATEGORIES.map((v) => ({ value: v, label: v }))}
              onChange={(v) => setCategory(v as CustomerCategory | undefined)}
              placeholder="All"
            />
          </View>
          <View style={styles.flex}>
            <Select
              label="Pay zone"
              value={payZone}
              options={PAY_ZONES.map((v) => ({ value: v, label: PAY_ZONE_LABEL[v] }))}
              onChange={(v) => setPayZone(v as PayZone | undefined)}
              placeholder="All"
            />
          </View>
        </View>
      </View>

      {status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : status === 'error' ? (
        <ErrorState title="Couldn’t load customers" onRetry={() => load('initial')} />
      ) : items.length === 0 ? (
        filtersActive ? (
          <EmptyState icon="search-outline" title="No matches" description="No customers match your search and filters." actionLabel="Clear filters" onAction={clearFilters} />
        ) : (
          <EmptyState icon="people-outline" title="No customers yet" description="Add your first customer to get started." actionLabel="New customer" onAction={() => router.push('/customers/new')} />
        )
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <Row item={item} onPress={() => router.push(`/customers/${item.id}`)} />}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.divider }]} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: spacing.lg }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: spacing['4xl'] }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth * 2 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  filterRow: { flexDirection: 'row', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowMain: { flex: 1, gap: 3 },
  rowEnd: { alignItems: 'flex-end', gap: 4 },
  semibold: { fontWeight: '600' },
  badges: { flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  sep: { height: StyleSheet.hairlineWidth * 2, marginLeft: 16 },
});
