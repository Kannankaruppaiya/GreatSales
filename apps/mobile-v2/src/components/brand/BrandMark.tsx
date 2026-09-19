import { View, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * The GreatSales mark and wordmark, from board "01 — Brand Assets".
 *
 * Drawn rather than shipped as an image, because the board holds no image:
 * every shape on it is a rectangle, a gradient, a text run or a vector path.
 * The assets directory carries only the stock Expo template icons, which is
 * what "the assets were never used properly" comes down to - there was nothing
 * to use. Code reproduces it at any size, in any colour the theme asks for,
 * and stays sharp on every density, which a PNG of a gradient square does not.
 *
 * Measured values, not guesses:
 *   mark 92x92 radius 24, gradient #2abf77 -> #0e7a4a on (0.1,0)->(0.9,1)
 *   mark 60x60 radius 16, same gradient
 *   glyph "G", Plus Jakarta Sans 800, white, 50px at 92 and 32px at 60
 *   wordmark "GreatSales" 34/800 with the leading G in #17a45e and the rest
 *     in #0f3244; 20px in the small variant
 *   sub "Field Sales CRM" 14/600 #6b8796
 *
 * The two documented mark sizes share one ratio, so this takes a size instead
 * of offering two components: 92*0.26 = 24 and 60*0.26 = 16, 92*0.54 = 50 and
 * 60*0.54 = 32. Both land exactly on the board's numbers.
 */
const RADIUS_RATIO = 0.26;
const GLYPH_RATIO = 0.54;

export function AppMark({ size = 92 }: { size?: number }) {
  const radius = Math.round(size * RADIUS_RATIO);
  const glyph = Math.round(size * GLYPH_RATIO);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="markGradient" x1="10%" y1="0%" x2="90%" y2="100%">
            <Stop offset="0" stopColor="#2abf77" />
            <Stop offset="1" stopColor="#0e7a4a" />
          </LinearGradient>
        </Defs>
        <Rect
          width={size}
          height={size}
          rx={radius}
          ry={radius}
          fill="url(#markGradient)"
        />
      </Svg>
      {/* The glyph sits over the square as real text so it picks up the font
          the rest of the app loads, rather than being traced into paths. */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'PlusJakartaSans_800ExtraBold',
            fontSize: glyph,
            lineHeight: glyph * 1.1,
            color: '#ffffff',
          }}
        >
          G
        </Text>
      </View>
    </View>
  );
}

/**
 * "GreatSales" over "Field Sales CRM".
 *
 * The leading G is a different colour from the rest, which is why this is one
 * Text with a nested Text rather than two side by side: nesting keeps them on
 * one baseline and lets the line wrap as a unit.
 */
export function Wordmark({
  size = 34,
  showSub = true,
}: {
  size?: number;
  showSub?: boolean;
}) {
  return (
    <View>
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_800ExtraBold',
          fontSize: size,
          color: '#0f3244',
        }}
      >
        <Text style={{ color: '#17a45e' }}>G</Text>reatSales
      </Text>
      {showSub ? (
        <Text
          style={{
            fontFamily: 'PlusJakartaSans_600SemiBold',
            // 14 under the 34 wordmark; the small variant keeps the ratio.
            fontSize: Math.round(size * (14 / 34)),
            color: '#6b8796',
          }}
        >
          Field Sales CRM
        </Text>
      ) : null}
    </View>
  );
}
