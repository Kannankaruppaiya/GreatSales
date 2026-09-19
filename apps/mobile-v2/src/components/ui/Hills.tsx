import Svg, { Path } from 'react-native-svg';

/**
 * The two hills that close the pre-sign-in screens.
 *
 * Both paths are the design's own, kept in the design's coordinate space with
 * a viewBox rather than re-pointed by hand: the board draws them from x 2976
 * to 3352 - 376 wide - ending at y 1199, and the group is 82 tall, so the box
 * starts 82 above that. Translating the numbers myself would be arithmetic
 * nobody can check against the file.
 */
export function Hills({ height = 82 }: { height?: number }) {
  return (
    <Svg
      width="100%"
      height={height}
      viewBox="2976 1117 376 82"
      preserveAspectRatio="none"
    >
      <Path
        fill="#e2f3eb"
        d="M2976,1168.25L3025.44,1144.33L3061.87,1159.71L3111.31,1132.38L3165.95,1158L3217.99,1139.21L3267.43,1161.42L3316.87,1142.63L3352,1158L3352,1199L2976,1199Z"
      />
      <Path
        fill="#d2ebdf"
        d="M2976,1180.21L3033.25,1159.71L3082.69,1175.08L3139.93,1152.88L3197.18,1171.67L3251.82,1156.29L3303.86,1175.08L3352,1163.13L3352,1199L2976,1199Z"
      />
    </Svg>
  );
}

/**
 * The blue-grey three-layer variant, from Screen 02A Sales Progress.
 *
 * A different picture from the green two-layer one above, not a recolour: it
 * has three ridges with their own silhouettes, at #e6f1f4, #d8eaef and
 * #cae1e8, and it stands 85 tall against the other's 82.
 */
export function HillsCool({ height = 85 }: { height?: number }) {
  return (
    <Svg width="100%" height={height} viewBox="2974.64 4074.15 376 85" preserveAspectRatio="none">
      <Path
        fill="#e6f1f4"
        d="M2974.64,4115.88L3026.68,4091.15L3065.71,4108.15L3115.15,4083.42L3169.80,4106.61L3221.84,4089.61L3271.28,4109.70L3320.72,4092.70L3350.64,4106.61L3350.64,4159.15L2974.64,4159.15Z"
      />
      <Path
        fill="#d8eaef"
        d="M2974.64,4128.24L3031.89,4108.15L3083.93,4123.61L3141.17,4101.97L3198.42,4120.52L3253.06,4105.06L3305.10,4123.61L3350.64,4111.24L3350.64,4159.15L2974.64,4159.15Z"
      />
      <Path
        fill="#cae1e8"
        d="M2974.64,4142.15L3037.09,4126.70L3099.54,4139.06L3169.80,4122.06L3234.85,4137.52L3297.30,4125.15L3350.64,4135.97L3350.64,4159.15L2974.64,4159.15Z"
      />
    </Svg>
  );
}
