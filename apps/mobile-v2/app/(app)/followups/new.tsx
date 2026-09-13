import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/design-system/theme';
import { spacing } from '../../../src/design-system/tokens';
import {
  GSHeader,
  GSButton,
  GSInput,
  GSSelect,
  GSDatePicker,
} from '../../../src/components/ui';
import { useCustomers, useCreateFollowUp } from '../../../src/hooks';
import { getTodayIso } from '../../../src/domain/calculations';
import { hapticFeedback } from '../../../src/utils/haptics';

export default function NewFollowUpScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: customers } = useCustomers();
  const createMutation = useCreateFollowUp();

  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState(getTodayIso());
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const customerOptions = (customers || []).map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const priorityOptions = [
    { label: 'High Priority', value: 'High' },
    { label: 'Medium Priority', value: 'Medium' },
    { label: 'Low Priority', value: 'Low' },
  ];

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please enter a follow-up task title.');
      return;
    }
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }

    const selectedCust = customers?.find((c) => c.id === customerId);

    setError('');
    await createMutation.mutateAsync({
      title: title.trim(),
      customerId,
      customerName: selectedCust?.name || '',
      dueDate,
      priority,
      notes: notes.trim() || undefined,
      done: false,
      salespersonId: 'user-sales-1',
      entityType: 'customer',
      entityId: customerId,
    });

    hapticFeedback('success');
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader title="New Follow-up Task" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing[8] },
          ]}
        >
          <GSInput
            label="Task Title *"
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (error) setError('');
            }}
            placeholder="e.g. Call regarding quotation review"
            error={error && !title ? error : undefined}
          />

          <View style={{ marginBottom: spacing[4] }}>
            <GSSelect
              label="Associated Customer *"
              value={customerId}
              options={customerOptions}
              onSelect={(val: string) => {
                setCustomerId(val);
                if (error) setError('');
              }}
            />
          </View>

          <View style={{ marginBottom: spacing[4] }}>
            <GSDatePicker
              label="Due Date *"
              value={dueDate}
              onChange={setDueDate}
            />
          </View>

          <View style={{ marginBottom: spacing[4] }}>
            <GSSelect
              label="Priority Level"
              value={priority}
              options={priorityOptions}
              onSelect={(val: string) => setPriority(val as any)}
            />
          </View>

          <GSInput
            label="Notes / Talking Points"
            value={notes}
            onChangeText={setNotes}
            placeholder="Key discussion points, requirements, or agreed deliverables..."
            multiline
            numberOfLines={4}
          />

          <View style={styles.actions}>
            <GSButton
              title="Cancel"
              variant="secondary"
              onPress={() => router.back()}
              style={{ flex: 1, marginRight: spacing[2] }}
            />
            <GSButton
              title="Schedule Task"
              variant="primary"
              onPress={handleSave}
              loading={createMutation.isPending}
              style={{ flex: 1, marginLeft: spacing[2] }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
});
