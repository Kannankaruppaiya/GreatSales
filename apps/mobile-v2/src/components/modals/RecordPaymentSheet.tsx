import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet, GSButton, GSInput, GSAmountDisplay, GSSelect } from '../ui';
import { useRecordPayment, usePayments } from '../../hooks';
import { formatCurrencyINR, formatLakhs } from '../../domain/formatters';
import { hapticFeedback } from '../../utils/haptics';

export interface RecordPaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  paymentId?: string;
  invoiceCode?: string;
  customerName?: string;
  outstandingAmount?: number;
}

export function RecordPaymentSheet({
  visible,
  onClose,
  paymentId: initialPaymentId,
  invoiceCode: initialInvoiceCode,
  customerName: initialCustomerName,
  outstandingAmount: initialOutstandingAmount,
}: RecordPaymentSheetProps) {
  const { colors } = useTheme();
  const { data: allPayments } = usePayments();
  const pendingPayments = (allPayments || []).filter((p) => (p.pending ?? p.amount) > 0);

  const [selectedId, setSelectedId] = useState<string>(initialPaymentId || '');
  const activePayment = initialPaymentId
    ? {
        id: initialPaymentId,
        invoiceCode: initialInvoiceCode || '',
        customerName: initialCustomerName || '',
        amount: initialOutstandingAmount || 0,
      }
    : pendingPayments.find((p) => p.id === selectedId) || pendingPayments[0];

  const currentOutstanding = activePayment ? (activePayment.amount ?? 0) : (initialOutstandingAmount ?? 0);
  const currentInvoice = activePayment?.invoiceCode || (activePayment as any)?.invoiceNo || initialInvoiceCode || 'Invoice';
  const currentCustomer = activePayment?.customerName || initialCustomerName || 'Customer';

  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialPaymentId) {
      setSelectedId(initialPaymentId);
      setAmountStr(String(initialOutstandingAmount || ''));
    } else if (pendingPayments.length > 0 && !selectedId) {
      setSelectedId(pendingPayments[0].id);
      setAmountStr(String(pendingPayments[0].amount || ''));
    }
  }, [initialPaymentId, initialOutstandingAmount, pendingPayments.length]);

  const recordMutation = useRecordPayment();

  const handleConfirm = async () => {
    const num = parseFloat(amountStr);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }
    if (num > currentOutstanding) {
      setError(`Amount cannot exceed outstanding balance (${formatCurrencyINR(currentOutstanding)})`);
      return;
    }

    const targetId = activePayment?.id || selectedId || initialPaymentId;
    if (!targetId) {
      setError('Please select an invoice.');
      return;
    }

    setError('');
    await recordMutation.mutateAsync({
      id: targetId,
      amount: num,
      note: note.trim() || undefined,
    });
    hapticFeedback('success');
    onClose();
  };

  const invoiceOptions = pendingPayments.map((p) => ({
    label: `${p.invoiceCode || (p as any).invoiceNo || 'INV'} • ${p.customerName} (${formatLakhs(p.amount)})`,
    value: p.id,
  }));

  return (
    <GSBottomSheet
      visible={visible}
      onClose={onClose}
      title="Record Payment"
      subtitle={`Invoice ${currentInvoice} • ${currentCustomer}`}
    >
      <View style={styles.content}>
        {/* Invoice Selector if opened without fixed payment */}
        {!initialPaymentId && invoiceOptions.length > 0 && (
          <View style={{ marginBottom: spacing[3] }}>
            <GSSelect
              label="Select Pending Invoice"
              value={selectedId}
              options={invoiceOptions}
              onSelect={(val: string) => {
                setSelectedId(val);
                const p = pendingPayments.find((item) => item.id === val);
                if (p) setAmountStr(String(p.amount));
                if (error) setError('');
              }}
            />
          </View>
        )}

        {/* Outstanding Banner */}
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.bannerLabel, { color: colors.textSecondary }]}>
            CURRENT OUTSTANDING
          </Text>
          <GSAmountDisplay amount={currentOutstanding} size="lg" variant="brand" />
        </View>

        <GSInput
          label="Payment Amount Received (₹)"
          value={amountStr}
          onChangeText={(t) => {
            setAmountStr(t);
            if (error) setError('');
          }}
          keyboardType="numeric"
          error={error}
          placeholder="Enter amount"
        />

        <GSInput
          label="Receipt Note / Reference (Optional)"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. NEFT ref #AXIS9918237..."
        />

        <View style={styles.actions}>
          <GSButton
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            disabled={recordMutation.isPending}
            style={{ flex: 1, marginRight: spacing[2] }}
          />
          <GSButton
            title="Confirm Receipt"
            variant="primary"
            onPress={handleConfirm}
            loading={recordMutation.isPending}
            style={{ flex: 1, marginLeft: spacing[2] }}
          />
        </View>
      </View>
    </GSBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing[4],
  },
  banner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  bannerLabel: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
});
