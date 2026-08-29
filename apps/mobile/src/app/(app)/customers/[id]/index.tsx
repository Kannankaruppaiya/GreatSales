/**
 * Customer detail — view + edit + delete. Reloads on focus so edits made on the
 * edit screen show immediately. Delete is confirmed (destructive) and soft on
 * the server. 404 (ownership/RLS or deleted) shows a clear not-found state.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api/errors';
import { deleteCustomer, getCustomer } from '@/lib/api/customers-api';
import {
  PAYMENT_TERMS_LABEL,
  PAY_ZONE_LABEL,
  PAY_ZONE_TONE,
  type CustomerDetail,
} from '@/lib/api/customer-types';
import { useTheme } from '@/theme/theme-provider';

type LoadState =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error' }
  | { status: 'ready'; customer: CustomerDetail };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="bodySm" color="muted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setState({ status: 'loading' });
    try {
      const customer = await getCustomer(id);
      setState({ status: 'ready', customer });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setState({ status: 'notfound' });
      else setState({ status: 'error' });
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function confirmDelete() {
    if (!id) return;
    Alert.alert('Delete customer?', 'This will archive the customer. It can be restored by an administrator.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteCustomer(id);
            router.back();
          } catch (err) {
            setDeleting(false);
            Alert.alert('Couldn’t delete', err instanceof ApiError ? err.userMessage : 'Please try again.');
          }
        },
      },
    ]);
  }

  if (state.status === 'loading') {
    return (
      <Screen center>
        <LoadingState label="Loading customer…" />
      </Screen>
    );
  }
  if (state.status === 'notfound') {
    return (
      <Screen center>
        <EmptyState
          icon="alert-circle-outline"
          title="Customer not found"
          description="It may have been deleted, or you don’t have access to it."
          actionLabel="Back to customers"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }
  if (state.status === 'error') {
    return (
      <Screen center>
        <ErrorState title="Couldn’t load this customer" onRetry={load} />
      </Screen>
    );
  }

  const c = state.customer;

  return (
    <Screen scroll contentStyle={{ gap: spacing.lg }}>
      <Stack.Screen
        options={{
          title: 'Customer',
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/customers/${c.id}/edit`)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Edit customer"
              style={{ paddingHorizontal: 4 }}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <View style={{ gap: spacing.sm }}>
        <Text variant="h2">{c.name}</Text>
        <View style={styles.badges}>
          {c.category ? <Badge label={c.category} tone="neutral" /> : null}
          {c.payZone ? <Badge label={`${PAY_ZONE_LABEL[c.payZone]} zone`} tone={PAY_ZONE_TONE[c.payZone]} /> : null}
        </View>
      </View>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Field label="Salesperson" value={c.salespersonName ?? 'Unassigned'} />
          <Divider />
          <Field label="Area" value={c.area ?? '—'} />
          <Divider />
          <Field label="Industry" value={c.industryName ?? '—'} />
          <Divider />
          <Field label="Sub-industry" value={c.subIndustry ?? '—'} />
          <Divider />
          <Field label="Payment terms" value={c.paymentTerms ? PAYMENT_TERMS_LABEL[c.paymentTerms] : '—'} />
          <Divider />
          <Field label="Created" value={formatDate(c.createdAt)} />
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Text variant="h3">Contacts</Text>
        <Card padded={false}>
          {c.contacts.length === 0 ? (
            <View style={{ padding: spacing.lg }}>
              <Text variant="body" color="muted" center>
                No contacts recorded.
              </Text>
            </View>
          ) : (
            c.contacts.map((ct, i) => (
              <View key={ct.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ padding: spacing.lg, gap: 2 }}>
                  <View style={styles.contactHead}>
                    <Text variant="bodyLg" style={styles.semibold}>
                      {ct.name}
                    </Text>
                    {ct.isPrimary ? <Badge label="Primary" tone="primary" /> : null}
                  </View>
                  {ct.designation ? (
                    <Text variant="bodySm" color="secondary">
                      {ct.designation}
                    </Text>
                  ) : null}
                  {ct.phone ? (
                    <Text variant="bodySm" color="secondary">
                      {ct.phone}
                    </Text>
                  ) : null}
                  {ct.email ? (
                    <Text variant="bodySm" color="secondary">
                      {ct.email}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </Card>
      </View>

      <Button label="Delete customer" variant="destructive" leadingIcon="trash-outline" onPress={confirmDelete} loading={deleting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  semibold: { fontWeight: '600' },
  contactHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
