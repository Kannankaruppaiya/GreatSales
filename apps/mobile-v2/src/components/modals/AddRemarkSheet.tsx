import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing } from '../../design-system/tokens';
import { GSBottomSheet, GSButton, GSInput } from '../ui';
import { useLogActivity } from '../../hooks';
import { hapticFeedback } from '../../utils/haptics';

export interface AddRemarkSheetProps {
  visible: boolean;
  onClose: () => void;
  entityType: 'customer' | 'lead';
  entityId: string;
  customerId?: string;
  entityTitle: string;
}

export function AddRemarkSheet({
  visible,
  onClose,
  entityType,
  entityId,
  customerId,
  entityTitle,
}: AddRemarkSheetProps) {
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  const logMutation = useLogActivity();

  const handleConfirm = async () => {
    if (!remark.trim()) {
      setError('Please enter your remark note.');
      return;
    }
    setError('');

    await logMutation.mutateAsync({
      customerId: customerId || (entityType === 'customer' ? entityId : undefined),
      entityType,
      entityId,
      type: 'remark',
      title: 'Remark Added',
      description: remark.trim(),
    });

    hapticFeedback('success');
    onClose();
  };

  return (
    <GSBottomSheet
      visible={visible}
      onClose={onClose}
      title="Add Remark"
      subtitle={`For ${entityTitle}`}
    >
      <View style={styles.content}>
        <GSInput
          label="Remark Note"
          value={remark}
          onChangeText={(t) => {
            setRemark(t);
            if (error) setError('');
          }}
          placeholder="e.g. Visited plant in Peelamedu, discussed expanding cutting oil supply..."
          error={error}
          multiline
          numberOfLines={3}
        />

        <View style={styles.actions}>
          <GSButton
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            disabled={logMutation.isPending}
            style={{ flex: 1, marginRight: spacing[2] }}
          />
          <GSButton
            title="Save Remark"
            variant="primary"
            onPress={handleConfirm}
            loading={logMutation.isPending}
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
  actions: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
});
