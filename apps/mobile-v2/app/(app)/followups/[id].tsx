import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar,
  Clock,
  Check,
  Phone,
  MessageSquare,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import {
  GSHeader,
  GSBadge,
  GSSkeleton,
  GSErrorState,
  GSButton,
  GSIconButton,
} from '@/components/ui';
import { CompleteFollowUpSheet, SnoozeFollowUpSheet } from '@/components/modals';
import { useFollowUp, useCustomer } from '@/hooks';
import { formatShortDate } from '@/domain/formatters';
import { makePhoneCall, openWhatsApp } from '@/utils/communication';

export default function FollowUpDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: followUp, isLoading, isError, refetch } = useFollowUp(id || '');
  const { data: customer } = useCustomer(followUp?.customerId || '');

  const [completeSheetVisible, setCompleteSheetVisible] = useState(false);
  const [snoozeSheetVisible, setSnoozeSheetVisible] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Follow-up Detail" showBack />
        <View style={{ padding: spacing[4] }}>
          <GSSkeleton height={140} borderRadius={radius.lg} style={{ marginBottom: spacing[3] }} />
          <GSSkeleton height={100} borderRadius={radius.md} />
        </View>
      </View>
    );
  }

  if (isError || !followUp) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GSHeader title="Follow-up Detail" showBack />
        <GSErrorState title="Follow-up not found" onRetry={refetch} />
      </View>
    );
  }

  const isDone = followUp.status === 'Completed';
  const isOverdue = followUp.status === 'Overdue';
  const primaryContact = customer?.contacts?.[0];

  const priorityVariant =
    followUp.priority === 'High'
      ? 'danger'
      : followUp.priority === 'Medium'
      ? 'warning'
      : 'neutral';

  const statusVariant = isDone ? 'success' : isOverdue ? 'danger' : 'brand';

  const handleCall = () => {
    if (primaryContact?.phone) makePhoneCall(primaryContact.phone);
  };

  const handleWhatsApp = () => {
    if (primaryContact?.phone) openWhatsApp(primaryContact.phone, `Re: ${followUp.title}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Follow-up Detail"
        subtitle={followUp.title}
        showBack
        rightActions={
          !isDone ? (
            <GSButton
              title="Complete"
              variant="primary"
              size="sm"
              onPress={() => setCompleteSheetVisible(true)}
            />
          ) : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* Main Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: isOverdue && !isDone ? colors.danger : colors.border,
            },
          ]}
        >
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open customer ${followUp.customerName}`}
                onPress={() => router.push(`/(app)/customers/${followUp.customerId}` as any)}
                style={styles.customerLink}
              >
                <Text style={[styles.customerName, { color: colors.brand }]}>
                  {followUp.customerName}
                </Text>
                <ArrowUpRight size={16} color={colors.brand} />
              </Pressable>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {followUp.title}
              </Text>
            </View>

            <View style={styles.badgesCol}>
              <GSBadge label={followUp.priority || 'Medium'} variant={priorityVariant} size="sm" />
              <View style={{ height: 4 }} />
              <GSBadge label={followUp.status || (followUp.done ? 'Completed' : 'Upcoming')} variant={statusVariant} size="sm" showDot />
            </View>
          </View>

          {/* Due date strip */}
          <View
            style={[
              styles.dueStrip,
              { backgroundColor: colors.surfaceInteractive, borderColor: colors.borderSubtle },
            ]}
          >
            <View style={styles.dueIconRow}>
              {isOverdue && !isDone ? (
                <AlertCircle size={16} color={colors.danger} />
              ) : (
                <Calendar size={16} color={colors.brand} />
              )}
              <Text
                style={[
                  styles.dueLabel,
                  { color: isOverdue && !isDone ? colors.danger : colors.textPrimary },
                ]}
              >
                Due on {formatShortDate(followUp.dueDate)}
                {followUp.dueTime ? ` at ${followUp.dueTime}` : ''}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {followUp.notes ? (
            <View style={styles.notesBox}>
              <Text style={[styles.notesHeading, { color: colors.textTertiary }]}>
                AGENDA / NOTES
              </Text>
              <Text style={[styles.notesBody, { color: colors.textSecondary }]}>
                {followUp.notes}
              </Text>
            </View>
          ) : null}

          {/* Action buttons */}
          {!isDone && (
            <View style={styles.ctaRow}>
              <GSButton
                title="Snooze"
                variant="secondary"
                size="md"
                leftIcon={<Clock size={16} color={colors.textSecondary} />}
                onPress={() => setSnoozeSheetVisible(true)}
                style={{ flex: 1, marginRight: spacing[2] }}
              />
              <GSButton
                title="Complete Task"
                variant="primary"
                size="md"
                leftIcon={<Check size={16} color={colors.white} strokeWidth={3} />}
                onPress={() => setCompleteSheetVisible(true)}
                style={{ flex: 1, marginLeft: spacing[2] }}
              />
            </View>
          )}
        </View>

        {/* Customer Contact */}
        {primaryContact?.phone ? (
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Customer Contact
            </Text>

            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: colors.textPrimary }]}>
                  {primaryContact.name} ({primaryContact.designation || 'Key Decision Maker'})
                </Text>
                <Text style={[styles.contactPhone, { color: colors.textSecondary }]}>
                  {primaryContact.phone}
                </Text>
              </View>

              <View style={styles.contactActions}>
                <GSIconButton
                  icon={<MessageSquare size={16} color={colors.brand} />}
                  variant="subtle"
                  size="sm"
                  accessibilityLabel="WhatsApp"
                  onPress={handleWhatsApp}
                />
                <View style={{ width: spacing[2] }} />
                <GSIconButton
                  icon={<Phone size={16} color={colors.white} />}
                  variant="brand"
                  size="sm"
                  accessibilityLabel="Call"
                  onPress={handleCall}
                />
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Complete Sheet */}
      <CompleteFollowUpSheet
        visible={completeSheetVisible}
        onClose={() => setCompleteSheetVisible(false)}
        followUpId={followUp.id}
        title={followUp.title}
        customerName={followUp.customerName || followUp.title}
      />

      {/* Snooze Sheet */}
      <SnoozeFollowUpSheet
        visible={snoozeSheetVisible}
        onClose={() => setSnoozeSheetVisible(false)}
        followUpId={followUp.id}
        customerName={followUp.customerName || followUp.title}
      />
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
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  customerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    marginRight: 4,
  },
  title: {
    fontSize: typography.heading2.fontSize,
    fontWeight: '800',
  },
  badgesCol: {
    alignItems: 'flex-end',
  },
  dueStrip: {
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  dueIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueLabel: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
    marginLeft: spacing[2],
  },
  notesBox: {
    paddingVertical: spacing[2],
    marginBottom: spacing[3],
  },
  notesHeading: {
    fontSize: typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesBody: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: 22,
  },
  ctaRow: {
    flexDirection: 'row',
    marginTop: spacing[2],
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
    marginBottom: spacing[3],
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactName: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  contactPhone: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
