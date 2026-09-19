import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/**
 * The drawn phone inside two rings, from Screen 01B Location.
 *
 * Rings: 229×229, two circles at 216 and 156 across, stroked 1.5 #c7e6d6 and
 * 1.4 #dcf0e6. The phone sits 72×139 inside them.
 *
 * Both of the phone's paths are the design's own, in the design's coordinate
 * space, so the viewBox frames the 86×151 group exactly - the rectangles and
 * the ellipse are offset into that same space rather than the paths being
 * re-pointed into a local one.
 */
const RULE_LINES =
  'M3522.776,573.672L3595.224,558.052M3522.776,615.328L3595.224,599.707M3544.667,525.769L3556.394,663.231M3575.939,525.769L3585.061,663.231';

const SCREEN_PIN =
  'M3559,555.448C3549.645,555.448,3542.061,563.025,3542.061,572.371C3542.061,585.128,3559,603.612,3559,603.612C3559,603.612,3575.939,585.128,3575.939,572.371C3575.939,563.025,3568.355,555.448,3559,555.448Z';

/** The design's group origin, which every local coordinate below is offset by. */
const OX = 3516;
const OY = 519;

export function LocationIllustration({ size = 229 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 229 229">
        <Circle cx={115} cy={115} r={108} stroke="#c7e6d6" strokeWidth={1.5} fill="none" />
        <Circle cx={114} cy={114} r={78} stroke="#dcf0e6" strokeWidth={1.4} fill="none" />
      </Svg>

      {/* 86×151, centred in the rings as the board centres it. */}
      <Svg
        width={86}
        height={151}
        viewBox={`${OX} ${OY} 86 151`}
        style={{ position: 'absolute' }}
      >
        <Rect x={OX + 2} y={OY + 2} width={83} height={148} rx={10} fill="#ffffff" stroke="#17495c" strokeWidth={2.2} />
        <Rect x={OX + 7} y={OY + 7} width={72} height={137} rx={7} fill="#f0f8f4" />
        <Path d={RULE_LINES} stroke="#d8ede2" strokeWidth={1.5} fill="none" />
        <Path d={SCREEN_PIN} fill="#17a45e" />
        <Ellipse cx={OX + 43.5} cy={OY + 53} rx={6.5} ry={6} fill="#ffffff" />
      </Svg>
    </View>
  );
}
