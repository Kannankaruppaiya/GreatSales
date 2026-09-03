import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, space, useColors, type AppColors } from '@/lib/theme';

export function Screen({
  children,
  edges = ['top'],
}: {
  children: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          padding: space.lg,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Txt({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: 'title' | 'heading' | 'body' | 'label' | 'caption' | 'stat';
  color?: string;
  style?: object;
  numberOfLines?: number;
}) {
  const c = useColors();
  const styles = textStyles(c);
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: color + '22',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, color }: { name: string; color: string }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color, fontWeight: '700' }}>{letters}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const c = useColors();
  const bg =
    variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : c.card;
  const fg = variant === 'secondary' ? c.text : '#FFFFFF';
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: bg,
        borderColor: variant === 'secondary' ? c.border : bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.md,
        paddingVertical: 14,
        paddingHorizontal: 18,
        opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
      })}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
} & TextInputProps) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={c.textMuted}
        style={{
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: c.text,
          fontSize: 15,
        }}
        {...rest}
      />
    </View>
  );
}

export interface Option {
  id: string;
  label: string;
}

/** Labeled picker that opens a modal list. */
export function SelectField({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select…',
}: {
  label: string;
  value: string | null;
  options: Option[];
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}>
        <Text style={{ color: selected ? c.text : c.textMuted, fontSize: 15 }}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={c.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide">
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}>
          <Pressable
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: 32,
              maxHeight: '70%',
            }}>
            <View style={{ padding: space.lg }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>
                {label}
              </Text>
            </View>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    onSelect(o.id);
                    setOpen(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: space.lg,
                    paddingVertical: 14,
                    borderTopColor: c.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  }}>
                  <Text style={{ color: c.text, fontSize: 15 }}>{o.label}</Text>
                  {o.id === value ? (
                    <Ionicons name="checkmark" size={20} color={c.primary} />
                  ) : null}
                </Pressable>
              ))}
              {options.length === 0 ? (
                <Text style={{ color: c.textMuted, padding: space.lg }}>
                  No options available.
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
      <Ionicons name="cloud-offline-outline" size={40} color={c.textMuted} />
      <Text style={{ color: c.textMuted, textAlign: 'center' }}>{message}</Text>
      {onRetry ? (
        <View style={{ width: 160 }}>
          <Button title="Retry" onPress={onRetry} variant="secondary" icon="refresh" />
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.sm }}>
      <Ionicons name={icon} size={44} color={c.textMuted} />
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: c.textMuted, textAlign: 'center' }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function Fab({
  onPress,
  icon = 'add',
}: {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: space.lg,
        bottom: space.xl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: c.primary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      })}>
      <Ionicons name={icon} size={28} color="#FFFFFF" />
    </Pressable>
  );
}

export function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderBottomColor: c.border,
        borderBottomWidth: StyleSheet.hairlineWidth,
        backgroundColor: c.bg,
      }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
      ) : null}
      <Text
        numberOfLines={1}
        style={{ flex: 1, color: c.text, fontSize: 18, fontWeight: '700' }}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Row({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress?: () => void;
}) {
  const c = useColors();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        backgroundColor: c.card,
        borderColor: c.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.md,
        padding: space.md,
      }}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

function textStyles(c: AppColors) {
  return StyleSheet.create({
    title: { color: c.text, fontSize: 26, fontWeight: '800' },
    heading: { color: c.text, fontSize: 18, fontWeight: '700' },
    body: { color: c.text, fontSize: 15 },
    label: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    caption: { color: c.textMuted, fontSize: 12 },
    stat: { color: c.text, fontSize: 24, fontWeight: '800' },
  });
}
