import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { C } from '@/gs/theme';
import { login, useSessionStatus } from '@/gs/auth';
import { ApiError } from '@/gs/api';
import { BrandMark } from '@/gs/BrandMark';

export default function Login() {
  const status = useSessionStatus();
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
          // 401 is deliberately indistinguishable — the server will not say
          // whether the account exists, and neither should this. 403 is
          // different: the credential was correct and the server is telling
          // this person something they can act on (locked out, or an account
          // that belongs on the web console rather than in the field app).
          // Collapsing the two, as this used to, told an administrator their
          // own password was wrong.
          err.status === 401
            ? 'Incorrect email or password.'
            : err.status === 403
              ? err.message
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

  // `index` is the fallback route, so it renders first on a cold start while
  // bootstrap() is still exchanging the stored refresh token. Showing the form
  // during that window flashes a login screen at an already-signed-in user.
  if (status === 'unknown') {
    return (
      <SafeAreaView className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator size="large" color={C.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: '#022c22' }} className="flex-1">
      <View className="flex-1 justify-center items-center px-4">
        <View className="w-full max-w-[420px] gap-6">
          {/* Brand Header */}
          <View className="flex-row items-center gap-3.5 px-1">
            <BrandMark size={48} />
            <View>
              <Text className="text-white text-2xl font-black tracking-tight">GreatSales</Text>
              <Text className="text-emerald-300 text-xs font-semibold mt-0.5">Field Sales · Salesperson</Text>
            </View>
          </View>

          {/* Login Card */}
          <View className="bg-white rounded-2xl p-6 shadow-2xl border border-emerald-950/20 gap-1.5">
            <Text className="text-xl font-black text-slate-900">Sign in</Text>
            <Text className="text-xs text-slate-500 font-medium mb-3 leading-relaxed">
              Welcome back. Track your projections, deals and collections.
            </Text>

            <Label>Workspace</Label>
            <TextInput
              className="border border-slate-200 rounded-xl px-3.5 py-3 text-[14px] text-slate-900 bg-slate-50 font-medium"
              value={tenantId}
              onChangeText={setTenantId}
              autoCapitalize="none"
              placeholder="workspace-id"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Workspace ID"
            />

            <Label>Email</Label>
            <TextInput
              className="border border-slate-200 rounded-xl px-3.5 py-3 text-[14px] text-slate-900 bg-slate-50 font-medium"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@company.com"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Email"
            />

            <Label>Password</Label>
            <TextInput
              className="border border-slate-200 rounded-xl px-3.5 py-3 text-[14px] text-slate-900 bg-slate-50 font-medium"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Password"
            />

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3 mt-3">
                <Text className="text-red-700 text-xs font-bold leading-tight">{error}</Text>
              </View>
            ) : null}

            <Pressable
              className="mt-5 bg-emerald-600 active:bg-emerald-700 rounded-xl py-3.5 items-center shadow-md shadow-emerald-700/30"
              onPress={() => { void handleLogin(); }}
              disabled={loading}
              accessibilityLabel="Sign in"
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white font-black text-[14px] tracking-wide">Sign in</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <Text className="text-center text-emerald-400/80 text-[11px] font-medium pb-4">
        © GreatWorks · v1.0.0
      </Text>
    </SafeAreaView>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text className="text-[11px] font-extrabold text-slate-700 mt-2 mb-1 uppercase tracking-wider">
      {children}
    </Text>
  );
}
