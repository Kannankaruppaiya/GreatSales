import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  type ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';

export interface GSBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: number | string;
  style?: ViewStyle;
}

export function GSBottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = '85%',
  style,
}: GSBottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal"
          onPress={onClose}
          style={styles.scrim}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              maxHeight: maxHeight as any,
            },
            style,
          ]}
        >
          {/* Drag Handle Indicator */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          </View>

          {/* Header */}
          {(title || subtitle) && (
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.titleContainer}>
                {title && (
                  <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {title}
                  </Text>
                )}
                {subtitle && (
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {subtitle}
                  </Text>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={styles.closeBtn}
              >
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {/* Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  scrim: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.sectionTitle.fontSize,
    fontWeight: '700',
    lineHeight: typography.sectionTitle.lineHeight,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing[2],
    marginLeft: spacing[2],
  },
  body: {
    padding: spacing[4],
  },
});
