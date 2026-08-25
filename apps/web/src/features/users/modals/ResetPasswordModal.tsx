import { useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useResetPassword } from "@/features/users/queries";
import { PasswordField } from "@/features/users/PasswordField";
import type { UserRow } from "@/features/users/types";

/**
 * Admin-initiated password reset.
 *
 * Separate from the edit form because it is a different and more dangerous
 * act with consequences an administrator needs told up front: it ends every
 * session the person has, and forces them to choose their own password before
 * they can do anything else.
 *
 * The chosen password is shown once, here, and never again — the server does
 * not store it in a readable form and this component does not keep it after
 * close. That is deliberate: a credential that can be re-read later is a
 * credential that leaks later.
 */
export function ResetPasswordModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow;
}) {
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const serverCode = reset.error instanceof ApiError ? reset.error.code : undefined;
  const serverMessage =
    reset.error instanceof ApiError ? reset.error.message : undefined;
  const passwordError = serverCode === "WEAK_PASSWORD" ? serverMessage : undefined;
  const otherError =
    reset.isError && serverCode !== "WEAK_PASSWORD"
      ? (serverMessage ?? "Could not reset the password.")
      : undefined;

  const handleConfirm = async () => {
    try {
      await reset.mutateAsync({ id: user.id, password: password.trim() });
      setDone(true);
    } catch {
      // Surfaced inline below.
    }
  };

  const handleClose = () => {
    // Clear the credential from component state on the way out, so it does not
    // survive in memory behind a closed dialog.
    setPassword("");
    setDone(false);
    setCopied(false);
    reset.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand" />
          <span>Reset password for {user.name}</span>
        </div>
      }
      maxWidth="max-w-md"
      footer={
        done ? (
          <Button size="sm" type="button" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={handleConfirm}
              disabled={!password.trim() || reset.isPending}
            >
              {reset.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3">
          <p className="text-xs text-ink leading-relaxed">
            Done. <strong>{user.name}</strong> has been signed out of every
            device and will be asked to choose a new password the next time they
            sign in.
          </p>

          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Give them this password now — it will not be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-ink break-all">
                {password}
              </code>
              <button
                type="button"
                aria-label="Copy password"
                onClick={() => {
                  void navigator.clipboard?.writeText(password);
                  setCopied(true);
                }}
                className="text-muted hover:text-ink cursor-pointer"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-brand" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <p className="text-[11.5px] text-ink leading-relaxed">
              This signs <strong>{user.name}</strong> out of every device
              immediately, and they will have to choose a new password before
              they can use GreatSales again.
            </p>
          </div>

          <PasswordField
            value={password}
            onChange={setPassword}
            identity={{
              name: user.name,
              email: user.email,
              username: user.username,
            }}
            required
            label="New password"
            serverError={passwordError}
          />

          {otherError && (
            <p role="alert" className="text-[11.5px] font-medium text-red">
              {otherError}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
