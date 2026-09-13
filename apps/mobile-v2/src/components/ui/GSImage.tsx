import React, { useState } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import { ImageIcon } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { radius } from '../../design-system/tokens';
import { GSSkeleton } from './GSSkeleton';

export interface GSImageProps {
  source: string | number | { uri: string };
  style?: ViewStyle | ViewStyle[];
  contentFit?: ImageContentFit;
  borderRadius?: number;
  showSkeleton?: boolean;
  accessibilityLabel?: string;
  onError?: () => void;
  onLoad?: () => void;
  testID?: string;
}

export function GSImage({
  source,
  style,
  contentFit = 'cover',
  borderRadius = radius.md,
  showSkeleton = true,
  accessibilityLabel,
  onError,
  onLoad,
  testID,
}: GSImageProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const imageSource = typeof source === 'string' ? { uri: source } : source;

  const handleLoad = () => {
    setLoading(false);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setLoading(false);
    setHasError(true);
    if (onError) onError();
  };

  return (
    <View style={[styles.wrapper, { borderRadius, overflow: 'hidden' }, style]}>
      {hasError ? (
        <View
          style={[
            styles.fallbackContainer,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <ImageIcon size={24} color={colors.textTertiary} />
        </View>
      ) : (
        <>
          <Image
            testID={testID}
            source={imageSource}
            style={[styles.image, { borderRadius }]}
            contentFit={contentFit}
            transition={200}
            cachePolicy="memory-disk"
            onLoad={handleLoad}
            onError={handleError}
            accessibilityLabel={accessibilityLabel}
          />
          {loading && showSkeleton && (
            <View style={StyleSheet.absoluteFill}>
              <GSSkeleton width="100%" height="100%" borderRadius={borderRadius} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
