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
