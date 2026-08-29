/**
 * Login — the one fully-wired workflow. Validates locally, calls the real
 * `/auth/login`, stores the session, and routes into the admin app. Handles the
 * failure paths a real user hits: wrong credentials, offline, timeout, and an
 * expired-session return. Entered data is never discarded on error.
 */
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { ThemeToggle } from "@/components/theme-toggle";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/auth-context";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { tenantId?: string; email?: string; password?: string };

export function LoginPage() {
  const { status, login, endedReason, clearEndedReason } = useAuth();

  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") return <Navigate to="/" replace />;

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!tenantId.trim()) next.tenantId = "Enter your workspace ID.";
    if (!email.trim()) next.email = "Enter your email.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function doLogin() {
    if (submitting) return;
    if (endedReason) clearEndedReason();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login({ tenantId: tenantId.trim(), email: email.trim(), password });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setFormError({ message: "Incorrect workspace, email, or password.", retryable: false });
        } else if (err.kind === "network" || err.kind === "timeout") {
          setFormError({ message: err.userMessage, retryable: true });
        } else {
          setFormError({ message: err.userMessage, retryable: false });
        }
      } else {
        setFormError({ message: "Something went wrong. Please try again.", retryable: true });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void doLogin();
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 pb-16">
        <div className="mb-6 flex flex-col gap-1">
          <Text variant="display" color="link" as="h1">
            GreatSales
          </Text>
          <Text variant="body" color="secondary">
            Sign in to your admin workspace.
          </Text>
        </div>

        <Card>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            {endedReason === "expired" ? (
              <Banner tone="info" message="Your session expired. Please sign in again." />
            ) : null}

            {formError ? (
              <Banner
                tone="error"
                message={formError.message}
                actionLabel={formError.retryable ? "Try again" : undefined}
                onAction={formError.retryable ? () => void doLogin() : undefined}
              />
            ) : null}

            <Input
              label="Workspace ID"
              required
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                if (errors.tenantId) setErrors((s) => ({ ...s, tenantId: undefined }));
              }}
              error={errors.tenantId}
              helper="Provided by your administrator."
              autoComplete="organization"
              autoCapitalize="none"
              disabled={submitting}
            />
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((s) => ({ ...s, email: undefined }));
              }}
              error={errors.email}
              autoComplete="email"
              autoCapitalize="none"
              disabled={submitting}
            />
            <Input
              label="Password"
              secure
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((s) => ({ ...s, password: undefined }));
              }}
              error={errors.password}
              autoComplete="current-password"
              disabled={submitting}
            />

            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
