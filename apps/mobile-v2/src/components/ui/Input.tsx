import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import type { TextInputProps } from 'react-native';
import { ICONS, type IconName } from '../../design-system/icons';

/**
 * A labelled text field, measured off Screen 01A Login.
 *
 *   label        14/600 #0f3244, 19 tall, 10pt above the field
 *   field        319x49 radius 12, #ffffff, 1px #dfe8ed
 *   leading icon 20px at 18pt from the field's left edge
 *   text         15/400, starting 47pt in - 18 + 20 + 9
 *   placeholder  #9cb2bd
 *
 * Width is NOT fixed at 319. That is 376 minus the board's 22pt gutters, so
 * the field fills its container and the screen supplies the gutter.
 */
export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  icon?: IconName;
  /** Renders the eye toggle and masks the value, as the password field does. */
  secure?: boolean;
}

export function Input({ label, icon, secure = false, ...rest }: InputProps) {
  const [revealed, setRevealed] = useState(false);
  const Icon = icon ? ICONS[icon] : null;
  const Eye = revealed ? ICONS['eye-off'] : ICONS['eye'];

  return (
    <View>
      {label ? (
        <Text
          className="text-ink"
          // 19, the board's box height - see the note in login.tsx.
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 19 }}
        >
          {label}
        </Text>
      ) : null}

      <View
        className="flex-row items-center bg-surface border border-fieldLine"
        style={{ height: 49, borderRadius: 12, marginTop: label ? 10 : 0, paddingHorizontal: 18 }}
      >
        {Icon ? <Icon size={20} color="#9cb2bd" /> : null}
        <TextInput
          // The design's placeholder colour, not the platform's grey.
          placeholderTextColor="#9cb2bd"
          secureTextEntry={secure && !revealed}
          className="flex-1 text-ink"
          style={{
            fontFamily: 'PlusJakartaSans_400Regular',
            fontSize: 15,
            marginLeft: Icon ? 9 : 0,
            // Android centres text in a taller box than iOS does; zeroing the
            // padding is what keeps one baseline across both.
            paddingVertical: 0,
          }}
          {...rest}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((v) => !v)}
            hitSlop={12}
          >
            <Eye size={21} color="#9cb2bd" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
