import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, LogOut } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth, useAuthUser } from "@/store/auth";
import { Button, Card, Input } from "@/components/ui";
import { PasswordField } from "@/features/users/PasswordField";
import type { AuthUser } from "@/features/projections/types";

/**
 * The way out of a forced password change.
 *
 * Without this screen the whole `mustChangePassword` mechanism is a trap: an
 * administrator resets someone's password, that person signs in successfully,
 * and is then refused by every endpoint with no way to fix it.
 *
 * Sign out stays available throughout. A screen a user cannot leave is not an
 * acceptable state to put someone in, even briefly.
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const logout = useAuth((s) => s.logout);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  const wrongCurrent = error?.status === 401;
  const weakNew = error?.code === "WEAK_PASSWORD";
  const otherError =
    error && !wrongCurrent && !weakNew
      ? error.message
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return; // guards a double submit, which would 401 the second time
    setPending(true);
    setError(null);

    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      // Re-read the profile so `mustChangePassword` is cleared in the store;
      // otherwise the guard would bounce us straight back here.
      const refreshed = await apiFetch<AuthUser>("/auth/me");
      useAuth.setState({ user: refreshed });
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e : null);
      if (!(e instanceof ApiError)) {
        setError(new ApiError(0, "Something went wrong. Please try again."));
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4 bg-surface-2">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="h-5 w-5 text-brand" />
          <h1 className="text-lg font-bold text-ink">Choose a new password</h1>
        </div>
        <p className="text-xs text-muted leading-relaxed mb-5">
          An administrator set the password you just used, so it is not private
          to you yet. Choose one only you know to continue.{" "}
          <strong>This signs you out on every other device.</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="cp-current"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
            >
              Current password *
            </label>
            <Input
              id="cp-current"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              aria-invalid={wrongCurrent}
              aria-describedby={wrongCurrent ? "cp-current-error" : undefined}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            {wrongCurrent && (
              <p
                id="cp-current-error"
                role="alert"
                className="text-[11.5px] font-medium text-red mt-1"
              >
                That current password is not correct.
              </p>
            )}
          </div>

          <PasswordField
            value={newPassword}
            onChange={setNewPassword}
            identity={{
              name: user?.name,
              email: user?.email,
              username: user?.username,
            }}
            required
            label="New password"
            serverError={weakNew ? error?.message : undefined}
          />

          {otherError && (
            <p role="alert" className="text-[11.5px] font-medium text-red">
              {otherError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!currentPassword || !newPassword || pending}
          >
            {pending ? "Saving…" : "Set new password"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 w-full text-center text-xs text-muted hover:text-ink cursor-pointer inline-flex items-center justify-center gap-1.5"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out instead
        </button>
      </Card>
    </div>
  );
}
