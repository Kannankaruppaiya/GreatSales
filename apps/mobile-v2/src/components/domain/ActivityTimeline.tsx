import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Phone, MessageSquare, Check, Plus, DollarSign, FileText } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { GSTimeline, type TimelineItem, GSEmptyState } from '../ui';
import type { Activity } from '../../domain/types';
import { formatRelativeTime } from '../../domain/formatters';

export interface ActivityTimelineProps {
  activities: Activity[];
  style?: ViewStyle;
}

export function ActivityTimeline({ activities, style }: ActivityTimelineProps) {
  const { colors } = useTheme();

  if (!activities || activities.length === 0) {
    return (
      <GSEmptyState
        title="No Activity Yet"
        description="Calls, remarks, and status transitions will appear here."
      />
    );
  }

  const items: TimelineItem[] = activities.map((act) => {
    let icon = <FileText size={12} color={colors.textSecondary} />;
    let completed = false;

    if (act.type === 'call') {
      icon = <Phone size={11} color={colors.brand} />;
      completed = true;
    } else if (act.type === 'stage_change') {
      icon = <Check size={11} color={colors.success} strokeWidth={2.5} />;
      completed = true;
    } else if (act.type === 'followup_done') {
      icon = <Check size={11} color={colors.success} strokeWidth={3} />;
      completed = true;
    } else if (act.type === 'payment') {
      icon = <DollarSign size={11} color={colors.brand} />;
      completed = true;
    }

    return {
      id: act.id,
      title: act.title || 'Activity',
      subtitle: `${act.performedByName ? `${act.performedByName}: ` : ''}${act.description}`,
      timestamp: formatRelativeTime(act.timestamp),
      completed,
      icon,
    };
  });

  return (
    <View style={[styles.container, style]}>
      <GSTimeline items={items} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
