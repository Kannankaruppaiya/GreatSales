import { View, TextInput, Pressable } from 'react-native';
import { SearchOutline, SortOutline } from '../illustrations/outline-glyphs';

/**
 * The search field and its sort button, from the head of every 02B/02C list.
 *
 *   field  289x42, radius 13, #eff5f8 on #e6eff3; magnifier at 14, 20 across
 *   sort    39x42, radius 13, white on the same rule
 *
 * The field is a real TextInput rather than a Text that looks like one. A
 * placeholder nobody can type into is the kind of thing that survives to
 * production because it photographs correctly.
 *
 * The board's widths add up: 19 + 289 + 11 + 39 + 18 = 376. The field takes
 * the slack so the pair still reaches both margins on a wider phone.
 */
export function ListSearchBar({
  placeholder,
  value,
  onChangeText,
  onPressSort,
}: {
  placeholder: string;
  value?: string;
  onChangeText?: (t: string) => void;
  onPressSort?: () => void;
}) {
  return (
    <View className="flex-row">
      <View
        className="flex-row items-center"
        style={{
          flex: 1, height: 42, borderRadius: 13,
          backgroundColor: '#eff5f8', borderWidth: 1, borderColor: '#e6eff3',
          paddingLeft: 14,
        }}
      >
        <SearchOutline />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8aa3b0"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1, marginLeft: 7, paddingVertical: 0,
            fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, lineHeight: 20, color: '#0f3244',
          }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sort"
        onPress={onPressSort}
        className="items-center justify-center"
        style={{
          width: 39, height: 42, borderRadius: 13, marginLeft: 11,
          backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e6eff3',
        }}
      >
        <SortOutline />
      </Pressable>
    </View>
  );
}
