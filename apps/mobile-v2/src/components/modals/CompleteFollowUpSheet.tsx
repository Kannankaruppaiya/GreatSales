import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing } from '../../design-system/tokens';
import { GSBottomSheet, GSButton, GSInput } from '../ui';
import { useCompleteFollowUp } from '../../hooks';
import { hapticFeedback } from '../../utils/haptics';

export interface CompleteFollowUpSheetProps {
  visible: boolean;
  onClose: () => void;
  followUpId: string;
  title: string;
  customerName: string;
}

export function CompleteFollowUpSheet({
  visible,
  onClose,
  followUpId,
  title,
  customerName,
}: CompleteFollowUpSheetProps) {
  const { colors } = useTheme();
  const [outcome, setOutcome] = useState('');

  const completeMutation = useCompleteFollowUp();

  const handleConfirm = async () => {
    await completeMutation.mutateAsync({
      id: followUpId,
      outcomeNote: outcome.trim() || undefined,
    });
    hapticFeedback('success');
    onClose();
  };

  return (
    <GSBottomSheet
      visible={visible}
      onClose={onClose}
      title="Complete Follow-up"
      subtitle={`${title} • ${customerName}`}
    >
      <View style={styles.content}>
        <GSInput
          label="Outcome / Minutes of Meeting (Optional)"
          value={outcome}
          onChangeText={setOutcome}
          placeholder="e.g. Spoke with GM Purchase. Agreed to sample products and schedule delivery..."
          multiline
          numberOfLines={3}
        />

        <View style={styles.actions}>
          <GSButton
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            disabled={completeMutation.isPending}
            style={{ flex: 1, marginRight: spacing[2] }}
          />
          <GSButton
            title="Mark Completed"
            variant="primary"
            onPress={handleConfirm}
            loading={completeMutation.isPending}
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
