import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Trash2, ShoppingBag, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/design-system/theme';
import { spacing, radius, typography } from '../../src/design-system/tokens';
import {
  GSHeader,
  GSProgress,
  GSButton,
  GSInput,
  GSSelect,
  GSDatePicker,
  GSAmountDisplay,
  GSAvatar,
} from '../../src/components/ui';
import { useCustomers, useCreateOrder, useProducts } from '../../src/hooks';
import { calculateOrderTotals, getTodayIso } from '../../src/domain/calculations';
import { formatCurrencyINR, formatShortDate } from '../../src/domain/formatters';
import type { OrderItem } from '../../src/domain/types';

export default function NewOrderWizardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilterTab, setCustomerFilterTab] = useState('All');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityStr, setQuantityStr] = useState('10');
  const [transporter, setTransporter] = useState('VRL Logistics');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState(getTodayIso());
  const [error, setError] = useState('');

  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const createOrderMutation = useCreateOrder();

  const filteredCustomerList = React.useMemo(() => {
    if (!customers) return [];
    let list = customers;
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q));
    }
    return list;
  }, [customers, customerSearch]);

  const customerOptions = (customers || []).map((c) => ({
    value: c.id,
    label: c.name,
    subtitle: `${c.city} • Terms: ${c.paymentTermsDays}d`,
  }));

  const productOptions = (products || []).map((p) => ({
    value: p.id,
    label: `${p.principalName} - ${p.name}`,
    subtitle: `Rate: ₹${p.catalogPrice ?? p.basePrice} • SKU: ${p.sku}`,
  }));

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  const handleAddItem = () => {
    const prod = (products || []).find((p) => p.id === selectedProductId);
    const qty = parseInt(quantityStr, 10);
    if (!prod || isNaN(qty) || qty <= 0) {
      setError('Please select a valid product and quantity.');
      return;
    }

    const newItem: OrderItem = {
      id: `item-${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      quantity: qty,
      rate: prod.catalogPrice ?? prod.basePrice ?? 0,
      subtotal: qty * (prod.catalogPrice ?? prod.basePrice ?? 0),
    };

    setItems([...items, newItem]);
    setSelectedProductId('');
    setQuantityStr('10');
    setError('');
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const { subtotal, tax, total } = calculateOrderTotals(
    items.map((i) => ({ quantity: i.quantity, rate: i.rate }))
  );

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!customerId) {
        setError('Please select a customer for this order.');
        return;
      }
      if (!deliveryAddress && selectedCustomer) {
        setDeliveryAddress(selectedCustomer.address || `${selectedCustomer.area}, ${selectedCustomer.city}`);
      }
      setStep(2);
    } else if (step === 2) {
      if (items.length === 0) {
        setError('Please add at least one line item to the order.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!deliveryAddress.trim()) {
        setError('Please enter a delivery address.');
        return;
      }
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as any);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    const created = await createOrderMutation.mutateAsync({
      customerId,
      customerName: selectedCustomer?.name || 'Customer',
      salespersonId: 'usr-1',
      salespersonName: 'Megala',
      status: 'Created',
      items,
      subtotal,
      tax,
      total,
      deliveryAddress,
      transporter,
      expectedDelivery,
    });

    router.replace(`/(app)/orders/${created.id}` as any);
  };

  const stepProgress = (step / 4) * 100;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <GSHeader
        title="New Order"
        subtitle="Create sales order"
        showBack
        onBack={handleBack}
      />

      {/* 4-Step Circle Stepper matching Screen 4 */}
      <View style={[styles.stepperContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.stepperRow}>
          {[
            { num: 1, label: 'Customer' },
            { num: 2, label: 'Products' },
            { num: 3, label: 'Pricing' },
            { num: 4, label: 'Review' },
          ].map((s, idx) => {
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            return (
              <React.Fragment key={s.num}>
                {idx > 0 && (
                  <View
                    style={[
                      styles.stepperLine,
                      { backgroundColor: isCompleted ? colors.brand : colors.borderSubtle },
                    ]}
                  />
                )}
                <View style={styles.stepperItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      {
                        backgroundColor: isCompleted || isActive ? colors.brand : colors.surfaceMuted,
                        borderColor: isActive ? colors.brandStrong : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepCircleText,
                        { color: isCompleted || isActive ? colors.white : colors.textTertiary },
                      ]}
                    >
                      {s.num}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: isActive ? colors.brand : isCompleted ? colors.textPrimary : colors.textTertiary,
                        fontWeight: isActive ? '700' : '500',
                      },
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* STEP 1: CUSTOMER SELECTION matching Screen 4 */}
        {step === 1 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepSectionTitle, { color: colors.textPrimary }]}>
              Select Customer
            </Text>

            {/* Customer Search & Filter */}
            <View style={[styles.custSearchWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <GSInput
                value={customerSearch}
                onChangeText={setCustomerSearch}
                placeholder="Search by name, area, contact..."
                leftIcon={<Search size={16} color={colors.textTertiary} />}
              />
            </View>

            <View style={styles.chipFilterRow}>
              {['Recent', 'Nearby', 'All'].map((chip) => (
                <Pressable
                  key={chip}
                  onPress={() => setCustomerFilterTab(chip)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: customerFilterTab === chip ? colors.brand : colors.surfaceElevated,
                      borderColor: customerFilterTab === chip ? colors.brand : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: customerFilterTab === chip ? colors.white : colors.textSecondary },
                    ]}
                  >
                    {chip}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <Text style={[styles.errorAlertText, { color: colors.danger }]}>{error}</Text>
            ) : null}

            {/* Radio List of Customers */}
            <View style={styles.customerRadioList}>
              {(filteredCustomerList || []).map((cust) => {
                const isSelected = customerId === cust.id;
                return (
                  <Pressable
                    key={cust.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`Select ${cust.name}`}
                    onPress={() => {
                      setCustomerId(cust.id);
                      setError('');
                    }}
                    style={({ pressed }) => [
                      styles.custRadioRow,
                      {
                        backgroundColor: isSelected ? colors.surfaceInteractive : colors.surfaceElevated,
                        borderColor: isSelected ? colors.brand : colors.borderSubtle,
                      },
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <GSAvatar name={cust.name} size="md" style={styles.custRadioAvatar} />
                    <View style={styles.custRadioInfo}>
                      <Text numberOfLines={1} style={[styles.custRadioName, { color: colors.textPrimary }]}>
                        {cust.name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.custRadioSub, { color: colors.textSecondary }]}>
                        {cust.city} • {cust.industry || 'OEM / Industrial'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: isSelected ? colors.brand : colors.borderStrong,
                          backgroundColor: isSelected ? colors.brand : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <View style={styles.radioInnerDot} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 2: LINE ITEMS */}
        {step === 2 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Line Items
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Add lubricants, greases, or oils with quantities.
            </Text>

            {/* Item selection row */}
            <View
              style={[
                styles.addBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <GSSelect
                label="Product / SKU"
                placeholder="Choose lubricant..."
                value={selectedProductId}
                options={productOptions}
                onSelect={setSelectedProductId}
              />

              <GSInput
                label="Quantity (Units / Litres)"
                value={quantityStr}
                onChangeText={setQuantityStr}
                placeholder="10"
                keyboardType="numeric"
              />

              <GSButton
                title="Add Item"
                variant="outline"
                size="md"
                leftIcon={<Plus size={16} color={colors.brand} />}
                onPress={handleAddItem}
              />
            </View>

            {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

            {/* Items list */}
            {items.length > 0 ? (
              <View style={[styles.itemsListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.listHeading, { color: colors.textPrimary }]}>
                  Current Order Items ({items.length})
                </Text>

                {items.map((item) => (
                  <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.productName}</Text>
                      <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                        {item.quantity} units @ {formatCurrencyINR(item.rate ?? item.price ?? 0)}
                      </Text>
                    </View>

                    <Text style={[styles.itemSubtotal, { color: colors.textPrimary }]}>
                      {formatCurrencyINR(item.subtotal ?? item.lineTotal ?? 0)}
                    </Text>

                    <Pressable
                      onPress={() => handleRemoveItem(item.id)}
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}

                {/* Subtotal Banner */}
                <View style={styles.subtotalBanner}>
                  <Text style={[styles.subtotalLabel, { color: colors.textSecondary }]}>Lines Subtotal:</Text>
                  <Text style={[styles.subtotalVal, { color: colors.brand }]}>
                    {formatCurrencyINR(subtotal)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* STEP 3: DELIVERY & LOGISTICS */}
        {step === 3 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Logistics & Delivery
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Specify delivery destination and shipping transporter.
            </Text>

            <GSInput
              label="Delivery Address *"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              placeholder="e.g. Unit 4, SIDCO Phase II..."
              error={error}
              multiline
              numberOfLines={2}
            />

            <GSInput
              label="Transporter / Carrier"
              value={transporter}
              onChangeText={setTransporter}
              placeholder="e.g. VRL Logistics / ABT Parcel"
            />

            <GSDatePicker
              label="Expected Delivery Date"
              value={expectedDelivery}
              onChange={setExpectedDelivery}
            />
          </View>
        )}

        {/* STEP 4: REVIEW & CONFIRM */}
        {step === 4 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Review Sales Order
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Verify quantities and commercial totals with GST.
            </Text>

            <View style={[styles.reviewCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Customer</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{selectedCustomer?.name}</Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Total Items</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{items.length} line items</Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{formatCurrencyINR(subtotal)}</Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>GST (18%)</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{formatCurrencyINR(tax)}</Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.reviewLabel, { color: colors.textPrimary, fontWeight: '800' }]}>Grand Total</Text>
                <GSAmountDisplay amount={total} size="lg" variant="brand" />
              </View>
            </View>
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.actionRow}>
          {step > 1 && (
            <GSButton
              title="Previous"
              variant="secondary"
              onPress={handleBack}
              style={{ flex: 1, marginRight: spacing[2] }}
            />
          )}

          {step < 4 ? (
            <GSButton
              title="Next Step"
              variant="primary"
              onPress={handleNext}
              style={{ flex: 1, marginLeft: step > 1 ? spacing[2] : 0 }}
            />
          ) : (
            <GSButton
              title="Confirm & Dispatch Order"
              variant="primary"
              onPress={handleSubmit}
              loading={createOrderMutation.isPending}
              style={{ flex: 1, marginLeft: spacing[2] }}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepperContainer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperLine: {
    flex: 1,
    height: 2,
    marginHorizontal: spacing[1],
    marginBottom: 16,
  },
  stepperItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepCircleText: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
  },
  stepSectionTitle: {
    fontSize: 16,
    fontFamily: typography.sectionTitle.fontFamily,
    fontWeight: '700',
    marginBottom: spacing[3],
  },
  custSearchWrap: {
    marginBottom: spacing[2],
  },
  chipFilterRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  filterPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '600',
  },
  errorAlertText: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    marginBottom: spacing[2],
  },
  customerRadioList: {
    gap: spacing[2],
  },
  custRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  custRadioAvatar: {
    marginRight: spacing[3],
  },
  custRadioInfo: {
    flex: 1,
  },
  custRadioName: {
    fontSize: 14,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
  },
  custRadioSub: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    padding: spacing[4],
  },
  stepBox: {
    marginBottom: spacing[6],
  },
  stepTitle: {
    fontSize: typography.heading2.fontSize,
    fontWeight: '800',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  previewCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    marginTop: spacing[2],
  },
  previewHeading: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  previewName: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
  },
  previewSub: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  addBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    marginBottom: spacing[2],
  },
  itemsListCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
  },
  listHeading: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
    marginBottom: spacing[3],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  itemTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '800',
    marginRight: spacing[3],
  },
  deleteBtn: {
    padding: spacing[1],
  },
  subtotalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
  },
  subtotalLabel: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  subtotalVal: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
  },
  reviewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  reviewLabel: {
    fontSize: typography.bodySmall.fontSize,
  },
  reviewVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
});
