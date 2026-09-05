import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { C } from '@/gs/theme';
import { login } from '@/gs/auth';
import { ApiError } from '@/gs/api';

export default function Login() {
  const [tenantId, setTenantId] = useState('tenant_promech');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const user = await login(tenantId.trim(), email.trim().toLowerCase(), password);
      // Routing straight to the tabs with this flag set lands the user on a
      // screen where the API refuses every request.
      router.replace(user.mustChangePassword ? '/change-password' : '/(app)');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401 || err.status === 403
            ? 'Incorrect email or password.'
            : err.status === 429
              ? 'Too many attempts. Please wait a minute.'
              : err.message,
        );
      } else {
        setError('Could not reach the server. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-ink">
      <View className="flex-1 justify-center px-6 gap-6">
        <View className="flex-row items-center gap-3">
          <View className="w-12 h-12 rounded-md bg-brand items-center justify-center">
            <Text className="text-white font-black text-lg">GS</Text>
          </View>
          <View>
            <Text className="text-white text-[22px] font-black -tracking-[0.5px]">GreatSales</Text>
            <Text className="text-emerald-200 text-xs font-semibold mt-0.5">Field Sales · Salesperson</Text>
          </View>
        </View>

        <View className="bg-surface rounded-xl p-6 gap-1">
          <Text className="text-lg font-extrabold text-ink">Sign in</Text>
          <Text className="text-xs text-muted mb-2">Welcome back. Track your projections, deals and collections.</Text>

          <Label>Workspace</Label>
          <TextInput
            className="border border-line rounded-md px-3 py-[11px] text-[13px] text-ink bg-surface2"
            value={tenantId}
            onChangeText={setTenantId}
            autoCapitalize="none"
            placeholder="workspace-id"
            placeholderTextColor={C.faint}
            accessibilityLabel="Workspace ID"
          />

          <Label>Email</Label>
          <TextInput
            className="border border-line rounded-md px-3 py-[11px] text-[13px] text-ink bg-surface2"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@company.com"
            placeholderTextColor={C.faint}
            accessibilityLabel="Email"
          />

          <Label>Password</Label>
          <TextInput
            className="border border-line rounded-md px-3 py-[11px] text-[13px] text-ink bg-surface2"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={C.faint}
            accessibilityLabel="Password"
          />

          {error ? (
            <Text className="text-red-500 text-xs mt-2 font-semibold">{error}</Text>
          ) : null}

          <Pressable
            className="mt-4 bg-brand rounded-md py-[13px] items-center"
            onPress={() => { void handleLogin(); }}
            disabled={loading}
            accessibilityLabel="Sign in"
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white font-extrabold text-[13px]">Sign in</Text>
            )}
          </Pressable>
        </View>
      </View>
      <Text className="text-center text-emerald-300/70 text-[11px] pb-4">© GreatWorks · v1.0.0</Text>
    </SafeAreaView>
  );
}

function Label({ children }: { children: string }) {
  return <Text className="text-[11px] font-bold text-ink2 mt-2 mb-1 uppercase tracking-wide">{children}</Text>;
}
