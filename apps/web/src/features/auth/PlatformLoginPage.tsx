import { useState } from "react";
import { Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { usePlatformAuth, useIsPlatformAuthed } from "@/store/platformAuth";
import { ApiError } from "@/lib/api";

/**
 * Platform (owner) sign-in. Deliberately separate from the 4-role tenant
 * LoginPage: the platform token carries no tenant, and the tenant/platform
 * guards reject each other's tokens, so one shared form would only mislead.
 * On success the owner lands on the management Home grid.
 */
export default function PlatformLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authed = useIsPlatformAuthed();
  const login = usePlatformAuth((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: { pathname?: string } })?.from
    ?.pathname;

  if (authed) {
    return <Navigate to={from && from !== "/platform/login" ? from : "/managements"} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from && from !== "/platform/login" ? from : "/managements", {
        replace: true,
      });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid credentials"
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-canvas p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 space-y-4"
      >
        <div className="flex items-center gap-2 text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand-ink">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-bold leading-tight">Platform sign-in</h1>
            <p className="text-[11px] text-muted">Owner console · manage all companies</p>
          </div>
        </div>

        <label className="block text-xs font-bold text-muted">
          Email
          <input
            type="email"
            aria-label="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
          />
        </label>

        <label className="block text-xs font-bold text-muted">
          Password
          <input
            type="password"
            aria-label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
          />
        </label>

        {error && (
          <p role="alert" className="text-xs font-semibold text-red">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </button>

        <p className="text-center text-[11px] text-muted">
          Signing in to a single company?{" "}
          <Link to="/login" className="font-semibold text-brand-ink underline">
            Use the company sign-in
          </Link>
        </p>
      </form>
    </div>
  );
}
