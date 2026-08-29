/**
 * Sign in — the one fully-wired workflow. Validates locally, calls the real
 * `/auth/login`, stores the session, and routes into the app. Handles the
 * failure paths a real user hits: wrong credentials, offline, timeout, and an
 * expired-session return. Entered data is never discarded on error.
 */
import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from '@/theme/theme-provider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { tenantId?: string; email?: string; password?: string };

export default function SignInScreen() {
  const { spacing } = useTheme();
  const { status, login, endedReason, clearEndedReason } = useAuth();

  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Already signed in (e.g. deep link here) → go to the app.
  if (status === 'authenticated') return <Redirect href="/" />;

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!tenantId.trim()) next.tenantId = 'Enter your workspace ID.';
    if (!email.trim()) next.email = 'Enter your email.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit() {
    if (submitting) return; // guard against double-submit
    if (endedReason) clearEndedReason();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login({ tenantId: tenantId.trim(), email: email.trim(), password });
      // Navigation happens reactively once status flips to authenticated.
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setFormError({ message: 'Incorrect workspace, email, or password.', retryable: false });
        } else if (err.kind === 'network' || err.kind === 'timeout') {
          setFormError({ message: err.userMessage, retryable: true });
        } else {
          setFormError({ message: err.userMessage, retryable: false });
        }
      } else {
        setFormError({ message: 'Something went wrong. Please try again.', retryable: true });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll center>
      <View style={{ gap: spacing['2xl'] }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="display" color="link">
            GreatSales
          </Text>
          <Text variant="body" color="secondary">
            Sign in to your sales workspace.
          </Text>
        </View>

        {endedReason === 'expired' ? (
          <Banner tone="info" message="Your session expired. Please sign in again." />
        ) : null}

        {formError ? (
          <Banner
            tone="error"
            message={formError.message}
            actionLabel={formError.retryable ? 'Try again' : undefined}
            onAction={formError.retryable ? onSubmit : undefined}
          />
        ) : null}

        <View style={{ gap: spacing.lg }}>
          <TextField
            label="Workspace ID"
            required
            value={tenantId}
            onChangeText={(v) => {
              setTenantId(v);
              if (errors.tenantId) setErrors((e) => ({ ...e, tenantId: undefined }));
            }}
            error={errors.tenantId}
            helper="Provided by your administrator."
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            editable={!submitting}
            textContentType="organizationName"
          />
          <TextField
            ref={emailRef}
            label="Email"
            required
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!submitting}
          />
          <TextField
            ref={passwordRef}
            label="Password"
            required
            secure
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            error={errors.password}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            editable={!submitting}
          />
        </View>

        <Button label="Sign in" onPress={onSubmit} loading={submitting} />
      </View>
    </Screen>
  );
}
