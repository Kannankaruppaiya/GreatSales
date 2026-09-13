import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CalendarCheck, AlignLeft, Flag, Users } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet, GSInput, GSSelect, GSDatePicker, GSButton } from '../ui';
import { hapticFeedback } from '../../utils/haptics';

export interface NewFollowUpSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-fill the customer name when opening from a customer/lead context */
  prefillCustomerName?: string;
}

type PriorityValue = 'Low' | 'Medium' | 'High';
type FollowUpTypeValue = 'Call' | 'Visit' | 'Demo' | 'Proposal' | 'Payment' | 'Other';

const PRIORITY_OPTIONS = [
  { value: 'High', label: '🔴 High — Urgent', subtitle: 'Appears in red zone alerts' },
  { value: 'Medium', label: '🟡 Medium — This week', subtitle: 'Standard follow-up cadence' },
  { value: 'Low', label: '🟢 Low — When possible', subtitle: 'No urgency' },
];

const TYPE_OPTIONS: Array<{ value: FollowUpTypeValue; label: string }> = [
  { value: 'Call', label: 'Phone Call' },
  { value: 'Visit', label: 'Customer Visit' },
  { value: 'Demo', label: 'Product Demo' },
  { value: 'Proposal', label: 'Proposal Discussion' },
  { value: 'Payment', label: 'Payment Collection' },
  { value: 'Other', label: 'Other' },
];

export function NewFollowUpSheet({ visible, onClose, prefillCustomerName = '' }: NewFollowUpSheetProps) {
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState(prefillCustomerName);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<PriorityValue>('Medium');
  const [followUpType, setFollowUpType] = useState<FollowUpTypeValue>('Call');
  const [dueDate, setDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const isValid = title.trim().length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setLoading(true);
    hapticFeedback('success');

    // In the synthetic layer, we just close — the repo layer will be wired
    // to `POST /api/v1/followups` when the API is connected.
    setTimeout(() => {
      setLoading(false);
      // Reset fields
      setTitle('');
      setNotes('');
      setPriority('Medium');
      setFollowUpType('Call');
      setDueDate(new Date().toISOString().split('T')[0]);
      onClose();
    }, 400);
  };

  const handleClose = () => {
    setTitle('');
    setNotes('');
    setPriority('Medium');
    setFollowUpType('Call');
    setDueDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  return (
    <GSBottomSheet
      visible={visible}
      onClose={handleClose}
      title="New Follow-up Task"
      subtitle="Create a reminder to track a customer interaction"
    >
      <View style={styles.container}>
        {/* Task Title */}
        <GSInput
          label="Task Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Call to follow-up on proposal"
          leftIcon={<CalendarCheck size={16} color={colors.textTertiary} />}
        />

        {/* Customer (text entry — will become a select in API mode) */}
        <GSInput
          label="Customer / Account"
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Enter customer name"
          leftIcon={<Users size={16} color={colors.textTertiary} />}
        />

        {/* Follow-up Type */}
        <GSSelect
          label="Follow-up Type"
          value={followUpType}
          options={TYPE_OPTIONS}
          onSelect={(v) => setFollowUpType(v as FollowUpTypeValue)}
        />

        {/* Priority */}
        <GSSelect
          label="Priority"
          value={priority}
          options={PRIORITY_OPTIONS}
          onSelect={(v) => setPriority(v as PriorityValue)}
        />

        {/* Due Date */}
        <GSDatePicker
          label="Due Date"
          value={dueDate}
          onChange={setDueDate}
        />

        {/* Notes */}
        <GSInput
          label="Notes (Optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any context or reminders..."
          multiline
          numberOfLines={3}
          leftIcon={<AlignLeft size={16} color={colors.textTertiary} />}
        />

        <View style={styles.actions}>
          <GSButton
            title="Cancel"
            variant="secondary"
            onPress={handleClose}
            style={{ flex: 1, marginRight: spacing[2] }}
          />
          <GSButton
            title="Create Task"
            variant="primary"
            onPress={handleSave}
            disabled={!isValid}
            loading={loading}
            style={{ flex: 1, marginLeft: spacing[2] }}
          />
        </View>
      </View>
    </GSBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing[4],
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing[2],
  },
});
