import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { C } from '@/gs/theme';
import { ME } from '@/gs/mock';

export default function Login() {
  const [email, setEmail] = useState('sankar@acme.test');
  const [password, setPassword] = useState('Passw0rd!');

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
          <View className="border border-line rounded-md px-3 py-[11px] bg-surface2 justify-center">
            <Text className="text-[13px] text-ink2 font-semibold">Acme Industrials</Text>
          </View>

          <Label>Email</Label>
          <TextInput
            className="border border-line rounded-md px-3 py-[11px] text-[13px] text-ink bg-surface2"
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
            placeholder="you@company.com" placeholderTextColor={C.faint} accessibilityLabel="Email"
          />

          <Label>Password</Label>
          <TextInput
            className="border border-line rounded-md px-3 py-[11px] text-[13px] text-ink bg-surface2"
            value={password} onChangeText={setPassword} secureTextEntry
            placeholder="••••••••" placeholderTextColor={C.faint} accessibilityLabel="Password"
          />

          <Pressable className="mt-4 bg-brand rounded-md py-[13px] items-center" onPress={() => router.replace('/(app)')}>
            <Text className="text-white font-extrabold text-[13px]">Sign in as {ME.name.split(' ')[0]}</Text>
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
