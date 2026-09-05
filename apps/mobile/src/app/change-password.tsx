import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { C } from '@/gs/theme';
import { changePassword, logout, useAuthUser } from '@/gs/auth';
import { ApiError } from '@/gs/api';

/**
 * Forced password change.
 *
 * The app had no screen for this. Login ignored `mustChangePassword` and
 * routed straight to the tab bar, where the API's MustChangePasswordGuard then
 * refused every request — correctly, since the server holds that line — leaving
 * a rep whose password an admin had just reset stuck on a screen of errors with
 * no way forward and no way to fix it from the phone.
 *
 * "Sign out" stays reachable throughout: a user who cannot remember the
 * temporary password must be able to leave rather than be trapped here.
 */
export default function ChangePassword() {
  const user = useAuthUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!currentPassword || !newPassword) {
      setError('Enter your current and new password.');
      return;
    }
    if (newPassword !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      router.replace('/(app)');
    } catch (err) {
      if (err instanceof ApiError) {
        // 401 here means the CURRENT password was wrong, not that the session
        // expired — saying "signed out" would send the user to re-login with
        // the same password that just failed.
        setError(
          err.status === 401
            ? 'That is not your current password.'
            : err.message,
        );
      } else {
        setError('Could not reach the server. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // No navigation: clearing the session flips this screen's guard in the
    // root layout, which falls back to `index` on its own.
    await logout();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center px-6 gap-4">
        <View className="gap-1">
          <Text className="text-[22px] font-black text-ink tracking-tight">
            Choose a new password
          </Text>
          <Text className="text-xs text-muted font-medium leading-relaxed">
            An administrator set the password you just used, so it is not
            private to you yet. Choose one only you know to continue. This signs
            you out on every other device.
          </Text>
          {user ? (
            <Text className="text-[11px] text-muted font-bold mt-1">
              {user.email}
            </Text>
          ) : null}
        </View>

        <View className="gap-2.5">
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            placeholderTextColor={C.faint}
            secureTextEntry
            autoCapitalize="none"
            className="bg-surface border border-line rounded-xl px-3.5 py-3 text-[13px] text-ink font-medium"
          />
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor={C.faint}
            secureTextEntry
            autoCapitalize="none"
            className="bg-surface border border-line rounded-xl px-3.5 py-3 text-[13px] text-ink font-medium"
          />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm new password"
            placeholderTextColor={C.faint}
            secureTextEntry
            autoCapitalize="none"
            className="bg-surface border border-line rounded-xl px-3.5 py-3 text-[13px] text-ink font-medium"
          />
        </View>

        {error ? (
          <Text className="text-xs text-danger font-bold">{error}</Text>
        ) : null}

        <Pressable
          onPress={() => void submit()}
          disabled={loading}
          className={`bg-brand rounded-xl py-3.5 items-center ${loading ? 'opacity-50' : ''}`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-black text-[13px]">
              Set new password
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => void signOut()} className="items-center py-2">
          <Text className="text-xs font-bold text-muted">Sign out instead</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
