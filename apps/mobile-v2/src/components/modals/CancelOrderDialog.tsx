import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSButton, GSInput } from '../ui';
import { useCancelOrder } from '../../hooks';
import { hapticFeedback } from '../../utils/haptics';

export interface CancelOrderDialogProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  orderCode: string;
}

export function CancelOrderDialog({
  visible,
  onClose,
  orderId,
  orderCode,
}: CancelOrderDialogProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const cancelMutation = useCancelOrder();

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for cancelling this order.');
      return;
    }
    setError('');
    await cancelMutation.mutateAsync({
      id: orderId,
      reason: reason.trim(),
    });
    hapticFeedback('warning');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.box,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.danger }]}>Cancel Sales Order?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Are you sure you want to cancel order {orderCode}? This action will halt fulfillment and notify operations.
          </Text>

          <GSInput
            label="Cancellation Reason (Required)"
            value={reason}
            onChangeText={(t) => {
              setReason(t);
              if (error) setError('');
            }}
            placeholder="e.g. Customer modified specifications / project delayed..."
            error={error}
            multiline
            numberOfLines={2}
          />

          <View style={styles.actions}>
            <GSButton
              title="Keep Order"
              variant="secondary"
              onPress={onClose}
              disabled={cancelMutation.isPending}
              style={{ flex: 1, marginRight: spacing[2] }}
            />
            <GSButton
              title="Cancel Order"
              variant="danger"
              onPress={handleConfirm}
              loading={cancelMutation.isPending}
              style={{ flex: 1, marginLeft: spacing[2] }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  box: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[5],
  },
  title: {
    fontSize: typography.sectionTitle.fontSize,
    fontWeight: '800',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    marginBottom: spacing[4],
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing[3],
  },
});
