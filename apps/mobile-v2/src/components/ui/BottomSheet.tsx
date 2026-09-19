import { View, Text, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { ICONS } from '../../design-system/icons';

const X = ICONS['x'];

/**
 * The bottom sheet, measured off 02A.2 Select Period.
 *
 *   dim     the whole board at #16242b, 58% opacity
 *   sheet   flush to the bottom, 26pt top radius, white
 *   handle  48×6 radius 4 at #cfdae0, 16 below the sheet's top
 *   title   18/800 #0f3244 at x31, 34 below the top
 *   close   22 glyph at x318, on the title's line
 *
 * Height is NOT fixed at the board's 527. Different sheets in the design are
 * different heights - the period list is 527, the quick-action launcher is
 * taller - and the content is what decides. What is fixed is everything above:
 * the dim, the radius, the handle and the title row are the same on every one.
 *
 * The home indicator the board draws at the very bottom is the OS's, like the
 * status bar at the top, so it is not drawn here - the safe-area inset
 * reserves that space instead.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sits below the content, above the safe area - the "Apply" button. */
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tapping the dim closes, which every sheet in the design implies by
          leaving the screen visible behind it. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(22,36,43,0.58)' }}
      />
      <View
        className="bg-surface"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          borderTopLeftRadius: 26, borderTopRightRadius: 26,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{ width: 48, height: 6, borderRadius: 4, backgroundColor: '#cfdae0', alignSelf: 'center', marginTop: 16 }}
        />
        <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 31, marginTop: 12 }}>
          <Text
            className="text-ink"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, lineHeight: 24 }}
          >
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
            <X size={22} color="#0f3244" strokeWidth={2.2} />
          </Pressable>
        </View>

        {children}
        {footer}
      </View>
    </Modal>
  );
}

/**
 * One selectable row inside a sheet, from the period list.
 *
 *   row       329×44 radius 10; selected rows carry #eaf6f0, others nothing
 *   glyph     21 at x41
 *   label     14/500 #123e52, or 14/700 #0f3244 when selected
 *   selected  a 23 disc at #17a45e with a white tick, at x318
 *   otherwise an 8-wide chevron at x325
 */
export function SheetRow({
  icon, label, selected = false, onPress, showChevron = false,
}: {
  icon: ReactNode;
  label: string;
  selected?: boolean;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  const ChevronRight = ICONS['chevron-right'];
  const Check = ICONS['check'];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="flex-row items-center"
      style={{
        height: 44, borderRadius: 10, marginHorizontal: 23, paddingHorizontal: 18,
        backgroundColor: selected ? '#eaf6f0' : 'transparent',
      }}
    >
      {icon}
      <Text
        style={{
          flex: 1, marginLeft: 13,
          fontFamily: selected ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
          fontSize: 14, lineHeight: 19,
          color: selected ? '#0f3244' : '#123e52',
        }}
      >
        {label}
      </Text>
      {selected ? (
        <View
          className="items-center justify-center"
          style={{ width: 23, height: 23, borderRadius: 11.5, backgroundColor: '#17a45e' }}
        >
          <Check size={14} color="#ffffff" strokeWidth={2.4} />
        </View>
      ) : showChevron ? (
        <ChevronRight size={12} color="#93a9b5" />
      ) : null}
    </Pressable>
  );
}
