import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet, GSButton } from '../ui';
import { useUpdateAvatar, useRemoveAvatar } from '../../hooks';
import { hapticFeedback } from '../../utils/haptics';

export interface AvatarPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  hasAvatar: boolean;
}

export function AvatarPickerSheet({
  visible,
  onClose,
  hasAvatar,
}: AvatarPickerSheetProps) {
  const { colors } = useTheme();
  const updateAvatarMutation = useUpdateAvatar();
  const removeAvatarMutation = useRemoveAvatar();

  const handleCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to take a profile photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await updateAvatarMutation.mutateAsync(result.assets[0].uri);
        hapticFeedback('success');
        onClose();
      }
    } catch {
      Alert.alert('Camera Error', 'Could not open camera on this device.');
    }
  };

  const handleGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Gallery access is needed to select a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await updateAvatarMutation.mutateAsync(result.assets[0].uri);
        hapticFeedback('success');
        onClose();
      }
    } catch {
      Alert.alert('Gallery Error', 'Could not open media library.');
    }
  };

  const handleRemove = async () => {
    await removeAvatarMutation.mutateAsync();
    hapticFeedback('medium');
    onClose();
  };

  return (
    <GSBottomSheet
      visible={visible}
      onClose={onClose}
      title="Profile Photo"
      subtitle="Update your sales executive avatar"
    >
      <View style={styles.content}>
        <View style={styles.list}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo with camera"
            onPress={handleCamera}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Camera size={18} color={colors.brand} />
            <Text style={[styles.label, { color: colors.textPrimary }]}>Take Photo</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose from photo gallery"
            onPress={handleGallery}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ImageIcon size={18} color={colors.brand} />
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Choose from Gallery
            </Text>
          </Pressable>

          {hasAvatar && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              onPress={handleRemove}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: pressed ? colors.dangerSoft : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Trash2 size={18} color={colors.danger} />
              <Text style={[styles.label, { color: colors.danger }]}>Remove Photo</Text>
            </Pressable>
          )}
        </View>

        <GSButton
          title="Cancel"
          variant="secondary"
          onPress={onClose}
          style={{ marginTop: spacing[3] }}
        />
      </View>
    </GSBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing[4],
  },
  list: {
    gap: spacing[2],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderRadius: radius.md,
  },
  label: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    marginLeft: spacing[3],
  },
});
