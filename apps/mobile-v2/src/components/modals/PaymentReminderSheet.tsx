import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Mail, Check, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet, GSButton } from '../ui';
import { useSendPaymentReminder } from '../../hooks';
import type { Payment } from '../../domain/types';
import { hapticFeedback } from '../../utils/haptics';

export interface PaymentReminderSheetProps {
  visible: boolean;
  onClose: () => void;
  payment: Payment;
}

interface ReminderStage {
  key: 'mail1' | 'mail2' | 'mail3' | 'mail4';
  label: string;
  desc: string;
  sent: boolean;
}

export function PaymentReminderSheet({
  visible,
  onClose,
  payment,
}: PaymentReminderSheetProps) {
  const { colors } = useTheme();
  const reminderMutation = useSendPaymentReminder();

  const stages: ReminderStage[] = [
    {
      key: 'mail1',
      label: 'Stage 1: Friendly Reminder',
      desc: 'Gentle statement sent before/on due date.',
      sent: payment.mail1,
    },
    {
      key: 'mail2',
      label: 'Stage 2: Overdue Follow-up',
      desc: 'Second notice requesting expected transfer date.',
      sent: payment.mail2,
    },
    {
      key: 'mail3',
      label: 'Stage 3: Urgent Notice',
      desc: 'Urgent notice regarding supply hold risk.',
      sent: payment.mail3,
    },
    {
      key: 'mail4',
      label: 'Stage 4: Management Escalation',
      desc: 'Final formal notice before credit block.',
      sent: payment.mail4,
    },
  ];

  // Find next unsent stage
  const nextStage = stages.find((s) => !s.sent);

  const handleSendReminder = async (key: 'mail1' | 'mail2' | 'mail3' | 'mail4') => {
    await reminderMutation.mutateAsync({
      id: payment.id,
      stage: key,
    });
    hapticFeedback('success');
    onClose();
  };

  return (
    <GSBottomSheet
      visible={visible}
      onClose={onClose}
      title="Payment Reminders"
      subtitle={`Invoice ${payment.invoiceCode} • ${payment.customerName}`}
    >
      <View style={styles.content}>
        <View style={styles.list}>
          {stages.map((stage) => {
            return (
              <View
                key={stage.key}
                style={[
                  styles.card,
                  {
                    backgroundColor: stage.sent ? colors.surfaceMuted : colors.surface,
                    borderColor: stage.sent ? colors.border : colors.brand,
                  },
                ]}
              >
                <View style={styles.iconBox}>
                  {stage.sent ? (
                    <Check size={18} color={colors.success} strokeWidth={2.5} />
                  ) : (
                    <Mail size={18} color={colors.brand} />
                  )}
                </View>

                <View style={styles.textCol}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: stage.sent ? colors.textSecondary : colors.textPrimary,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {stage.label}
                  </Text>
                  <Text style={[styles.desc, { color: colors.textTertiary }]}>
                    {stage.desc}
                  </Text>
                  {stage.sent ? (
                    <Text style={[styles.statusTag, { color: colors.success }]}>
                      Sent to accounts contact
                    </Text>
                  ) : stage.key === nextStage?.key ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Send ${stage.label}`}
                      onPress={() => handleSendReminder(stage.key)}
                      style={[styles.sendBtn, { backgroundColor: colors.brand }]}
                    >
                      <Text style={styles.sendBtnText}>Dispatch Notice</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <GSButton
          title="Done"
          variant="secondary"
          onPress={onClose}
          style={{ marginTop: spacing[3] }}
        />
      </View>
    </GSBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing[4],
  },
  list: {
    gap: spacing[2],
  },
  card: {
    flexDirection: 'row',
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1.2,
    alignItems: 'flex-start',
  },
  iconBox: {
    marginRight: spacing[3],
    marginTop: 2,
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
  },
  desc: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  statusTag: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    marginTop: 6,
  },
  sendBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing[3],
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing[2],
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
  },
});
