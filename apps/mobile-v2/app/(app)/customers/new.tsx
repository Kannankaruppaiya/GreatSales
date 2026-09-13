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
import { AlertTriangle, ChevronRight, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSProgress,
  GSButton,
  GSInput,
  GSSelect,
  GSAmountDisplay,
} from '@/components/ui';
import { useCreateCustomer } from '@/hooks';
import { customerRepo } from '@/repositories';
import type { Customer, PaymentZoneValue } from '@/domain/types';

export default function NewCustomerWizardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('Coimbatore');
  const [address, setAddress] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactDesignation, setContactDesignation] = useState('Managing Director');

  const [industry, setIndustry] = useState('Automotive Engineering');
  const [tier, setTier] = useState('Tier-1');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [creditLimitStr, setCreditLimitStr] = useState('500000');
  const [paymentZone, setPaymentZone] = useState<PaymentZoneValue>('Green');

  const [duplicateMatches, setDuplicateMatches] = useState<Customer[]>([]);
  const [dismissDuplicate, setDismissDuplicate] = useState(false);
  const [error, setError] = useState('');

  const createCustomerMutation = useCreateCustomer();

  const handleCheckDuplicates = async (companyName: string) => {
    setName(companyName);
    if (companyName.trim().length >= 3) {
      const matches = await customerRepo.checkDuplicates(companyName.trim());
      setDuplicateMatches(matches);
    } else {
      setDuplicateMatches([]);
    }
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!name.trim()) {
        setError('Please enter the customer / company name.');
        return;
      }
      if (duplicateMatches.length > 0 && !dismissDuplicate) {
        setError('Please review possible existing accounts before proceeding.');
        return;
      }
      if (!city.trim()) {
        setError('Please enter a city.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!contactName.trim() || !contactPhone.trim()) {
        setError('Primary contact name and mobile number are required.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
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
    const created = await createCustomerMutation.mutateAsync({
      name: name.trim(),
      legalName: name.trim(),
      city: city.trim(),
      area: area.trim() || undefined,
      address: address.trim() || `${area}, ${city}`,
      industry,
      tier,
      paymentTermsDays: parseInt(paymentTermsDays, 10) || 30,
      creditLimit: parseFloat(creditLimitStr) || 500000,
      outstanding: 0,
      paymentZone,
      salespersonId: 'usr-1',
      salespersonName: 'Megala',
      contacts: [
        {
          id: `con-${Date.now()}`,
          name: contactName.trim(),
          phone: contactPhone.trim(),
          email: contactEmail.trim() || undefined,
          designation: contactDesignation.trim(),
          isPrimary: true,
        },
      ],
    });

    router.replace(`/(app)/customers/${created.id}` as any);
  };

  const stepProgress = (step / 4) * 100;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <GSHeader
        title="Add Customer"
        subtitle={`Step ${step} of 4: ${
          step === 1
            ? 'Company & Location'
            : step === 2
            ? 'Primary Contact'
            : step === 3
            ? 'Business & Terms'
            : 'Review & Register'
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
        {/* STEP 1: COMPANY & LOCATION */}
        {step === 1 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Company Details
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Enter the business trading name and location.
            </Text>

            <GSInput
              label="Company / Customer Name *"
              value={name}
              onChangeText={handleCheckDuplicates}
              placeholder="e.g. Kongu Precision Components"
              error={error}
            />

            {/* Duplicate Detection Warning Banner */}
            {duplicateMatches.length > 0 && !dismissDuplicate && (
              <View
                style={[
                  styles.duplicateBox,
                  { backgroundColor: colors.warningSoft, borderColor: colors.warning },
                ]}
              >
                <View style={styles.duplicateHeader}>
                  <AlertTriangle size={18} color={colors.warning} />
                  <Text style={[styles.duplicateTitle, { color: colors.warning }]}>
                    Possible Existing Customers ({duplicateMatches.length})
                  </Text>
                </View>
                <Text style={[styles.duplicateDesc, { color: colors.textSecondary }]}>
                  Similar company accounts were found in GreatSales database:
                </Text>

                {duplicateMatches.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => router.push(`/(app)/customers/${m.id}` as any)}
                    style={[styles.matchItem, { borderColor: colors.border }]}
                  >
                    <View>
                      <Text style={[styles.matchName, { color: colors.textPrimary }]}>{m.name}</Text>
                      <Text style={[styles.matchLoc, { color: colors.textSecondary }]}>{m.city} • {m.area}</Text>
                    </View>
                    <Text style={[styles.useText, { color: colors.brand }]}>View Account</Text>
                  </Pressable>
                ))}

                <GSButton
                  title="Create Anyway (Distinct Account)"
                  variant="outline"
                  size="sm"
                  onPress={() => setDismissDuplicate(true)}
                  style={{ marginTop: spacing[3] }}
                />
              </View>
            )}

            <GSInput
              label="Industrial Area / Landmark"
              value={area}
              onChangeText={setArea}
              placeholder="e.g. SIDCO Industrial Estate"
            />

            <GSInput
              label="City *"
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Coimbatore"
            />

            <GSInput
              label="Street Address"
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. Plot 42, Phase II, Kurichi"
            />
          </View>
        )}

        {/* STEP 2: PRIMARY CONTACT */}
        {step === 2 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Primary Contact
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Key person for purchasing, deliveries, and payment settlements.
            </Text>

            <GSInput
              label="Contact Person Name *"
              value={contactName}
              onChangeText={setContactName}
              placeholder="e.g. Mr. K. Murugesan"
              error={error}
            />

            <GSInput
              label="Mobile / WhatsApp Number *"
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="+91 98420 12345"
              keyboardType="phone-pad"
            />

            <GSInput
              label="Email Address (Optional)"
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="purchase@company.in"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <GSInput
              label="Designation / Role"
              value={contactDesignation}
              onChangeText={setContactDesignation}
              placeholder="e.g. Head of Purchase / Managing Director"
            />
          </View>
        )}

        {/* STEP 3: BUSINESS & CREDIT TERMS */}
        {step === 3 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Commercial Terms
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Set credit limit, payment window, and risk tier.
            </Text>

            <GSSelect
              label="Payment Zone"
              value={paymentZone}
              options={[
                { value: 'Green', label: 'Green Zone (High Reliability)' },
                { value: 'Yellow', label: 'Yellow Zone (Moderate Credit)' },
                { value: 'Red', label: 'Red Zone (Strict Advance Only)' },
              ]}
              onSelect={(z: string) => setPaymentZone(z as any)}
            />

            <GSInput
              label="Credit Window (Days)"
              value={paymentTermsDays}
              onChangeText={setPaymentTermsDays}
              placeholder="30"
              keyboardType="numeric"
            />

            <GSInput
              label="Credit Limit (₹)"
              value={creditLimitStr}
              onChangeText={setCreditLimitStr}
              placeholder="500000"
              keyboardType="numeric"
            />

            <GSInput
              label="Industry Classification"
              value={industry}
              onChangeText={setIndustry}
              placeholder="e.g. Automotive / Textiles / Heavy Machinery"
            />
          </View>
        )}

        {/* STEP 4: REVIEW */}
        {step === 4 && (
          <View style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Review Customer
            </Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Verify customer profile before creating.
            </Text>

            <View
              style={[
                styles.reviewCard,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Company</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{name}</Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Location</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{city} ({area || 'Main'})</Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Primary Contact</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{contactName} ({contactPhone})</Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Payment Zone</Text>
                <Text style={[styles.reviewVal, { color: colors.brand, fontWeight: '800' }]}>{paymentZone} Zone</Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Payment Terms</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{paymentTermsDays} Days</Text>
              </View>

              <View style={[styles.reviewRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Credit Limit</Text>
                <GSAmountDisplay amount={parseFloat(creditLimitStr) || 0} size="md" variant="default" />
              </View>
            </View>
          </View>
        )}

        {/* Actions Row */}
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
              title="Register Customer"
              variant="primary"
              onPress={handleSubmit}
              loading={createCustomerMutation.isPending}
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
  duplicateBox: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  duplicateTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
    marginLeft: 6,
  },
  duplicateDesc: {
    fontSize: typography.caption.fontSize,
    marginBottom: spacing[2],
  },
  matchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  matchName: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  matchLoc: {
    fontSize: typography.micro.fontSize,
  },
  useText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
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
