import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';

import { Button, Field, Loading, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { space, useColors } from '@/lib/theme';

export default function LoginScreen() {
  const c = useColors();
  const { user, loading, lastTenantId, signIn } = useAuth();

  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the tenant from the last successful login once restore completes.
  const resolvedTenant = tenantId || lastTenantId || '';

  if (loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (user) return <Redirect href="/(app)" />;

  async function onSubmit() {
    setError(null);
    if (!resolvedTenant || !email || !password) {
      setError('Tenant, email and password are all required.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(resolvedTenant.trim(), email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('Invalid credentials. Check tenant, email and password.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not sign in.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: space.xl,
            gap: space.lg,
          }}
          keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: c.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="trending-up" size={34} color="#FFFFFF" />
            </View>
            <Txt variant="title">GreatSales</Txt>
            <Txt variant="caption">Sign in to your workspace</Txt>
          </View>

          <Field
            label="Tenant ID"
            value={resolvedTenant}
            onChangeText={setTenantId}
            placeholder="tenant_acme"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.test"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            onSubmitEditing={onSubmit}
          />

          {error ? (
            <Txt variant="body" color={c.danger}>
              {error}
            </Txt>
          ) : null}

          <Button
            title="Sign in"
            onPress={onSubmit}
            loading={submitting}
            icon="log-in-outline"
          />

          <Txt variant="caption" style={{ textAlign: 'center' }}>
            Demo: tenant_acme · sales1@acme.test · Passw0rd!
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
