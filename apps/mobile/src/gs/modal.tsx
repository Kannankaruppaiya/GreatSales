import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal as RNModal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './theme';

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <RNModal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      // Android runs edge-to-edge from Expo SDK 54 on. Without these the modal
      // is laid out BELOW the status bar while touches are still resolved
      // against the full screen, so every control sits ~40px above its own hit
      // box: taps land on whatever is next to what you aimed at, silently. It
      // is the reason no option in this sheet could be selected on a phone
      // while the same code worked on web.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        // Android resizes the modal window itself; 'height' fights that and
        // re-measures in a loop. iOS gets no such help, so it keeps 'padding'.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
      >
        <Pressable className="flex-1 bg-black/50" onPress={onClose} />
        <View className="bg-surface rounded-t-3xl max-h-[92%] overflow-hidden shadow-2xl">
          {/* Grab Handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-12 h-1.5 rounded-full bg-line" />
          </View>

          {/* Header */}
          <View className="flex-row items-start gap-3 px-5 pt-2 pb-3.5 border-b border-line">
            <View className="flex-1">
              <Text className="text-lg font-black text-ink tracking-tight">{title}</Text>
              {subtitle ? <Text className="text-xs text-muted font-medium mt-0.5">{subtitle}</Text> : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="w-8 h-8 rounded-full bg-surface3 items-center justify-center"
            >
              <Text className="text-base text-muted font-black">x</Text>
            </Pressable>
          </View>

          <ScrollView
            className="px-5 bg-canvas"
            contentContainerClassName="py-4 gap-3.5"
            contentContainerStyle={footer ? undefined : { paddingBottom: 16 + insets.bottom }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {footer ? (
            <View
              className="flex-row gap-2.5 px-5 py-3.5 bg-surface border-t border-line"
              style={{ paddingBottom: 14 + insets.bottom }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">{label}</Text>
      {children}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.faint}
      keyboardType={keyboardType}
      multiline={multiline}
      className={`border border-line rounded-xl px-3.5 text-[13px] text-ink font-medium bg-surface shadow-sm ${
        multiline ? 'py-3 h-24' : 'py-3'
      }`}
      style={multiline ? { textAlignVertical: 'top' } : undefined}
    />
  );
}

/** Tap-to-select from a list of options, wraps into pills. */
export function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: string;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            // 44px is the smaller of the two platform minimums (iOS 44pt,
            // Android 48dp). Padding alone left these pills at ~32px, which is
            // a miss even when the touch coordinates are right. Growing the
            // control rather than adding hitSlop keeps the hit boxes of
            // adjacent pills from overlapping across the 6px gap.
            className={`px-3 py-2 min-h-[44px] justify-center rounded-xl border ${
              active ? 'bg-brand border-brand shadow-sm' : 'bg-surface border-line'
            }`}
          >
            <Text className={`text-xs font-black ${active ? 'text-white' : 'text-ink2'}`}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ModalBtn({
  label,
  onPress,
  variant = 'solid',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'ghost' | 'danger';
  /**
   * Blocks the press AND dims the control. A submit that is in flight or
   * missing a required field has to look unavailable, or the user taps it
   * again and the form appears to have swallowed the first tap.
   */
  disabled?: boolean;
}) {
  let box = 'bg-brand border border-brand shadow-sm';
  let txt = 'text-white';

  if (variant === 'danger') {
    box = 'bg-red-soft border border-red-border/60';
    txt = 'text-danger';
  } else if (variant === 'ghost') {
    box = 'bg-surface border border-line';
    txt = 'text-ink2';
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 py-3.5 rounded-xl items-center justify-center ${box} ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className={`text-[13px] font-black ${txt}`}>{label}</Text>
    </Pressable>
  );
}
