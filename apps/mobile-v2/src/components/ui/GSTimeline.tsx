import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';

export interface TimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  timestamp?: string;
  completed?: boolean;
  active?: boolean;
  icon?: React.ReactNode;
}

export interface GSTimelineProps {
  items: TimelineItem[];
  style?: ViewStyle;
}

export function GSTimeline({ items, style }: GSTimelineProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isDone = item.completed;
        const isActive = item.active;

        let nodeBg = colors.surfaceMuted;
        let nodeBorder = colors.border;
        if (isDone) {
          nodeBg = colors.success;
          nodeBorder = colors.success;
        } else if (isActive) {
          nodeBg = colors.brand;
          nodeBorder = colors.brand;
        }

        return (
          <View key={item.id} style={styles.row}>
            {/* Indicator column */}
            <View style={styles.indicatorCol}>
              <View
                style={[
                  styles.node,
                  {
                    backgroundColor: nodeBg,
                    borderColor: nodeBorder,
                  },
                ]}
              >
                {isDone ? (
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                ) : item.icon ? (
                  item.icon
                ) : (
                  <View
                    style={[
                      styles.innerDot,
                      { backgroundColor: isActive ? '#FFFFFF' : colors.textTertiary },
                    ]}
                  />
                )}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    {
                      backgroundColor: isDone ? colors.success : colors.border,
                    },
                  ]}
                />
              )}
            </View>

            {/* Content column */}
            <View style={[styles.contentCol, !isLast && { paddingBottom: spacing[4] }]}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    {
                      color: isActive || isDone ? colors.textPrimary : colors.textSecondary,
                      fontWeight: isActive ? '700' : '600',
                    },
                  ]}
                >
                  {item.title}
                </Text>
                {item.timestamp && (
                  <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                    {item.timestamp}
                  </Text>
                )}
              </View>
              {item.subtitle && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {item.subtitle}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
  },
  indicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  node: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  contentCol: {
    flex: 1,
    paddingLeft: spacing[3],
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
  },
  timestamp: {
    fontSize: typography.micro.fontSize,
    marginLeft: spacing[2],
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    marginTop: 2,
  },
});
