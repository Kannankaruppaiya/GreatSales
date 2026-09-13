import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet, GSButton, GSInput } from '../ui';
import { ORDER_STATUS_LABELS, type OrderStatusValue } from '../../domain/types';
import { useAdvanceOrderStatus } from '../../hooks';
import { hapticFeedback } from '../../utils/haptics';

export interface AdvanceOrderStatusSheetProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  orderCode: string;
  currentStatus: OrderStatusValue;
}

const ADVANCE_SEQUENCE: OrderStatusValue[] = [
  'Created',
  'Acknowledged',
  'Dispatched',
  'DeliveredFromWarehouse',
];

export function AdvanceOrderStatusSheet({
  visible,
  onClose,
  orderId,
  orderCode,
  currentStatus,
}: AdvanceOrderStatusSheetProps) {
  const { colors } = useTheme();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatusValue>(currentStatus);
  const [note, setNote] = useState('');

  const advanceMutation = useAdvanceOrderStatus();

  const handleConfirm = async () => {
    await advanceMutation.mutateAsync({
      id: orderId,
      nextStatus: selectedStatus,
      note: note.trim() || undefined,
    });
    hapticFeedback('success');
    onClose();
  };

  return (
    <GSBottomSheet
      visible={visible}
      onClose={onClose}
      title="Advance Order Status"
      subtitle={`Order ${orderCode}`}
    >
      <View style={styles.content}>
        <View style={styles.statusList}>
          {ADVANCE_SEQUENCE.map((status) => {
            const isSelected = status === selectedStatus;
            const isCurrent = status === currentStatus;
            const label = ORDER_STATUS_LABELS[status];

            return (
              <Pressable
                key={status}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => {
                  hapticFeedback('light');
                  setSelectedStatus(status);
                }}
                style={({ pressed }) => [
                  styles.item,
                  {
                    borderColor: isSelected ? colors.brand : colors.border,
                    backgroundColor: isSelected
                      ? colors.brandSoft
                      : pressed
                      ? colors.surfaceElevated
                      : colors.surface,
                  },
                ]}
              >
                <View style={styles.textCol}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: isSelected ? colors.brand : colors.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                  {isCurrent && (
                    <Text style={[styles.currentTag, { color: colors.textTertiary }]}>
                      Current State
                    </Text>
                  )}
                </View>
                {isSelected && <Check size={18} color={colors.brand} strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </View>

        <GSInput
          label="Status Change Note (Optional)"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Loaded onto VRL Logistics truck #TN-38-9921..."
          multiline
          numberOfLines={2}
          style={{ marginTop: spacing[3] }}
        />

        <View style={styles.actions}>
          <GSButton
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            disabled={advanceMutation.isPending}
            style={{ flex: 1, marginRight: spacing[2] }}
          />
          <GSButton
            title="Update Status"
            variant="primary"
            onPress={handleConfirm}
            loading={advanceMutation.isPending}
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
  statusList: {
    gap: spacing[2],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 1.2,
    borderRadius: radius.md,
  },
  textCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  label: {
    fontSize: typography.body.fontSize,
  },
  currentTag: {
    fontSize: typography.micro.fontSize,
    fontWeight: '600',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
});
