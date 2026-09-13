import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet, GSButton, GSInput } from '../ui';
import { DEAL_STAGES, STAGE_LABELS, type DealStageValue } from '../../domain/types';
import { useChangeLeadStage } from '../../hooks';
import { hapticFeedback } from '../../utils/haptics';

export interface ChangeLeadStageSheetProps {
  visible: boolean;
  onClose: () => void;
  leadId: string;
  currentStage: DealStageValue;
  customerName: string;
}

export function ChangeLeadStageSheet({
  visible,
  onClose,
  leadId,
  currentStage,
  customerName,
}: ChangeLeadStageSheetProps) {
  const { colors } = useTheme();
  const [selectedStage, setSelectedStage] = useState<DealStageValue>(currentStage);
  const [note, setNote] = useState('');

  const changeStageMutation = useChangeLeadStage();

  const handleSelect = (stage: DealStageValue) => {
    hapticFeedback('light');
    setSelectedStage(stage);
  };

  const handleConfirm = async () => {
    await changeStageMutation.mutateAsync({
      id: leadId,
      stage: selectedStage,
      note: note.trim() || undefined,
    });
    hapticFeedback('success');
    onClose();
  };

  return (
    <GSBottomSheet
      visible={visible}
      onClose={onClose}
      title="Move Deal Stage"
      subtitle={`For ${customerName}`}
    >
      <View style={styles.content}>
        <View style={styles.stageList}>
          {DEAL_STAGES.map((stage) => {
            const isSelected = stage === selectedStage;
            const isCurrent = stage === currentStage;
            const label = STAGE_LABELS[stage];

            return (
              <Pressable
                key={stage}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => handleSelect(stage)}
                style={({ pressed }) => [
                  styles.stageItem,
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
                <View style={styles.stageTextCol}>
                  <Text
                    style={[
                      styles.stageLabel,
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
                      Current Stage
                    </Text>
                  )}
                </View>
                {isSelected && <Check size={18} color={colors.brand} strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </View>

        <GSInput
          label="Transition Remark / Note (Optional)"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Received oral confirmation during site visit..."
          multiline
          numberOfLines={2}
          style={{ marginTop: spacing[3] }}
        />

        <View style={styles.actions}>
          <GSButton
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            disabled={changeStageMutation.isPending}
            style={{ flex: 1, marginRight: spacing[2] }}
          />
          <GSButton
            title="Update Stage"
            variant="primary"
            onPress={handleConfirm}
            loading={changeStageMutation.isPending}
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
  stageList: {
    gap: spacing[2],
  },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 1.2,
    borderRadius: radius.md,
  },
  stageTextCol: {
    flex: 1,
    marginRight: spacing[2],
  },
  stageLabel: {
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
