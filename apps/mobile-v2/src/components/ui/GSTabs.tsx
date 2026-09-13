import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { hapticFeedback } from '../../utils/haptics';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface GSTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChangeTab: (key: string) => void;
  scrollable?: boolean;
  style?: ViewStyle;
}

export function GSTabs({
  tabs,
  activeTab,
  onChangeTab,
  scrollable = false,
  style,
}: GSTabsProps) {
  const { colors } = useTheme();

  const handleSelect = (key: string) => {
    if (key === activeTab) return;
    hapticFeedback('light');
    onChangeTab(key);
  };

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label}${tab.count !== undefined ? `, ${tab.count}` : ''}`}
            onPress={() => handleSelect(tab.key)}
            style={[
              styles.tab,
              {
                backgroundColor: isActive ? colors.surface : 'transparent',
                borderRadius: radius.md - 2,
              },
            ]}
          >
            {tab.icon && <View style={styles.icon}>{tab.icon}</View>}
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? colors.textPrimary : colors.textSecondary,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
            {tab.count !== undefined && (
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isActive ? colors.brandSoft : colors.surfaceElevated,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    {
                      color: isActive ? colors.brand : colors.textTertiary,
                    },
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  scrollContent: {
    paddingVertical: spacing[1],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    minHeight: 38,
  },
  icon: {
    marginRight: spacing[1] + 2,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.bodySmall.fontFamily,
  },
  countBadge: {
    marginLeft: spacing[1] + 2,
    paddingHorizontal: spacing[1] + 2,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: typography.micro.fontSize,
    fontFamily: typography.micro.fontFamily,
    fontWeight: '700',
  },
});
