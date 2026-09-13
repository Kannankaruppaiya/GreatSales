import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';

export interface GSSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function GSSearchBar({
  value,
  onChangeText,
  placeholder = 'Search by customer, deal, product...',
  onClear,
  autoFocus = false,
  style,
  testID,
}: GSSearchBarProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChangeText('');
    if (onClear) onClear();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isFocused ? colors.surfaceInteractive : colors.surfaceElevated,
          borderColor: isFocused ? colors.brand : colors.border,
          borderRadius: radius.md,
        },
        style,
      ]}
    >
      <Search
        size={18}
        color={isFocused ? colors.brand : colors.textTertiary}
        style={styles.searchIcon}
      />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
          },
        ]}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={handleClear}
          style={styles.clearButton}
        >
          <X size={16} color={colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  input: {
    flex: 1,
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    height: '100%',
  },
  clearButton: {
    padding: spacing[1],
    marginLeft: spacing[1],
  },
});
