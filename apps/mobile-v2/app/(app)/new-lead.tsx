import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
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
} from '../../src/components/ui';
import { useCustomers, useCreateLead, useProducts } from '../../src/hooks';
import { getTodayIso } from '../../src/domain/calculations';
import { formatShortDate } from '../../src/domain/formatters';

export default function NewLeadWizardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState('');
  const [valueStr, setValueStr] = useState('');
  const [probabilityStr, setProbabilityStr] = useState('70');
  const [expectedClose, setExpectedClose] = useState(getTodayIso());
  const [followUpNote, setFollowUpNote] = useState('');
  const [error, setError] = useState('');

  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const createLeadMutation = useCreateLead();

  const customerOptions = (customers || []).map((c) => ({
    value: c.id,
    label: c.name,
    subtitle: `${c.city} • Outstanding: ₹${(c.outstanding / 100000).toFixed(1)}L`,
  }));

  const productOptions = (products || []).map((p) => ({
    value: p.id,
    label: `${p.principalName} - ${p.name}`,
    subtitle: `Default Rate: ₹${p.catalogPrice ?? p.basePrice}`,
  }));

  const selectedCustomer = customers?.find((c) => c.id === customerId);
  const selectedProduct = (products || []).find((p) => p.id === productId);

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!customerId) {
        setError('Please select a customer for this opportunity.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!title.trim()) {
        setError('Please enter an opportunity title.');
        return;
      }
      const val = parseFloat(valueStr);
      if (isNaN(val) || val <= 0) {
        setError('Please enter a valid deal value in ₹.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!expectedClose) {
        setError('Please set an expected close date.');
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
    const val = parseFloat(valueStr);
    const prob = parseInt(probabilityStr, 10) || 60;

    await createLeadMutation.mutateAsync({
      customerId,
      customerName: selectedCustomer?.name || 'Customer',
      title: title.trim(),
      productId: selectedProduct?.id,
      productName: selectedProduct?.name,
      principalId: selectedProduct?.principalId,
      principalName: selectedProduct?.principalName,
      value: val,
      probability: prob,
      stage: 'Lead',
      expectedClose,
      nextFollowUpDate: expectedClose,
      salespersonId: 'usr-1',
      salespersonName: 'Megala',
    });

    router.replace('/(app)/pipeline');
  };

  const stepProgress = (step / 4) * 100;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <GSHeader
        title="New Opportunity"
        subtitle={`Step ${step} of 4: ${
          step === 1
            ? 'Select Customer'
            : step === 2
            ? 'Opportunity Details'
            : step === 3
            ? 'Timeline & Follow-up'
            : 'Review & Submit'
        }`}
        showBack
        onBack={handleBack}
      />

      <GSProgress value={stepProgress} height={4} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* STEP 1: CUSTOMER */}
        {step === 1 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Which customer is this for?
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Select from your registered B2B customer accounts.
            </Text>

            <GSSelect
              label="Select Customer"
              placeholder="Tap to choose customer..."
              value={customerId}
              options={customerOptions}
              onSelect={setCustomerId}
              error={error}
            />

            {selectedCustomer && (
              <View
                style={[
                  styles.previewCard,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.previewHeading, { color: colors.textTertiary }]}>
                  CUSTOMER DETAILS
                </Text>
                <Text style={[styles.previewName, { color: colors.textPrimary }]}>
                  {selectedCustomer.name}
                </Text>
                <Text style={[styles.previewSub, { color: colors.textSecondary }]}>
                  {selectedCustomer.area}, {selectedCustomer.city} • Zone: {selectedCustomer.paymentZone}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* STEP 2: OPPORTUNITY DETAILS */}
        {step === 2 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Opportunity Details
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Specify the product, deal scope, and estimated revenue.
            </Text>

            <GSInput
              label="Opportunity Title *"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Annual Industrial Lubricant Contract"
              error={error}
            />

            <GSSelect
              label="Product / SKU (Optional)"
              placeholder="Choose product..."
              value={productId}
              options={productOptions}
              onSelect={setProductId}
            />

            <GSInput
              label="Estimated Deal Value (₹) *"
              value={valueStr}
              onChangeText={setValueStr}
              placeholder="e.g. 850000"
              keyboardType="numeric"
            />

            <GSInput
              label="Win Probability (%)"
              value={probabilityStr}
              onChangeText={setProbabilityStr}
              placeholder="70"
              keyboardType="numeric"
            />
          </View>
        )}

        {/* STEP 3: TIMELINE & FOLLOW-UP */}
        {step === 3 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Timeline & Schedule
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              When is this opportunity expected to close?
            </Text>

            <GSDatePicker
              label="Expected Close Date *"
              value={expectedClose}
              onChange={setExpectedClose}
            />

            <GSInput
              label="Next Action / Note (Optional)"
              value={followUpNote}
              onChangeText={setFollowUpNote}
              placeholder="e.g. Submit commercial proposal by Thursday..."
              multiline
              numberOfLines={2}
            />
          </View>
        )}

        {/* STEP 4: REVIEW & CONFIRM */}
        {step === 4 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Review Opportunity
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Verify details before publishing this deal to the pipeline.
            </Text>

            <View
              style={[
                styles.reviewCard,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Customer</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>
                  {selectedCustomer?.name}
                </Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Deal Title</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>
                  {title}
                </Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Product</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>
                  {selectedProduct?.name || 'General Requirement'}
                </Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Deal Value</Text>
                <GSAmountDisplay amount={parseFloat(valueStr) || 0} size="lg" variant="brand" />
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Win Probability</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>
                  {probabilityStr}%
                </Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Expected Close</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>
                  {formatShortDate(expectedClose)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Wizard Action Buttons */}
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
              title="Publish Deal"
              variant="primary"
              onPress={handleSubmit}
              loading={createLeadMutation.isPending}
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
