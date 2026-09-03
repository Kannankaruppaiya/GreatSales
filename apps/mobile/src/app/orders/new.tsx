import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import {
  Button,
  Card,
  Field,
  Header,
  Loading,
  Screen,
  SelectField,
  Txt,
} from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { radius, space, useColors } from '@/lib/theme';

interface LineItem {
  key: string;
  productId: string | null;
  qty: string;
  price: string;
}

let counter = 0;
const newItem = (): LineItem => ({
  key: `li_${counter++}`,
  productId: null,
  qty: '1',
  price: '',
});

export default function NewOrderScreen() {
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const { data: lookups, loading } = useAsync(() => api.lookups());

  const [customerId, setCustomerId] = useState<string | null>(
    params.customerId ?? null,
  );
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.price) || 0),
        0,
      ),
    [items],
  );

  function patch(key: string, next: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...next } : i)));
  }

  function onSelectProduct(key: string, productId: string) {
    const product = lookups?.products.find((p) => p.id === productId);
    patch(key, {
      productId,
      price: product?.basePrice ?? '',
    });
  }

  async function onSubmit() {
    setError(null);
    if (!customerId) {
      setError('Please choose a customer.');
      return;
    }
    const parsed = items
      .filter((i) => i.productId)
      .map((i) => ({
        productId: i.productId as string,
        qty: Number(i.qty),
        price: Number(i.price),
      }));
    if (parsed.length === 0) {
      setError('Add at least one product line.');
      return;
    }
    if (parsed.some((i) => Number.isNaN(i.qty) || i.qty <= 0 || Number.isNaN(i.price) || i.price < 0)) {
      setError('Each line needs a positive quantity and a valid price.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.orders.create({ customerId, items: parsed });
      router.replace(`/orders/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create order.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !lookups) {
    return (
      <Screen edges={['top']}>
        <Header title="New Order" onBack={() => router.back()} />
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header title="New Order" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled">
          <SelectField
            label="Customer"
            value={customerId}
            options={lookups?.customers ?? []}
            onSelect={setCustomerId}
          />

          <View style={{ gap: space.sm }}>
            <Txt variant="heading">Line items</Txt>
            {items.map((item, idx) => (
              <Card key={item.key} style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt variant="label">Item {idx + 1}</Txt>
                  {items.length > 1 ? (
                    <Pressable onPress={() => setItems((p) => p.filter((i) => i.key !== item.key))} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={c.danger} />
                    </Pressable>
                  ) : null}
                </View>
                <SelectField
                  label="Product"
                  value={item.productId}
                  options={lookups?.products ?? []}
                  onSelect={(pid) => onSelectProduct(item.key, pid)}
                />
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Qty"
                      value={item.qty}
                      onChangeText={(t) => patch(item.key, { qty: t })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Unit price"
                      value={item.price}
                      onChangeText={(t) => patch(item.key, { price: t })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </Card>
            ))}
            <Button
              title="Add item"
              variant="secondary"
              icon="add"
              onPress={() => setItems((p) => [...p, newItem()])}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: c.cardAlt,
              borderRadius: radius.md,
              padding: space.lg,
            }}>
            <Txt variant="heading">Total</Txt>
            <Txt variant="heading">{money(total)}</Txt>
          </View>

          {error ? <Txt variant="body" color={c.danger}>{error}</Txt> : null}

          <Button title="Create order" onPress={onSubmit} loading={submitting} icon="checkmark" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
