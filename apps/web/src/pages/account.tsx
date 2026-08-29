/**
 * Account — the signed-in user's profile from `/auth/me`, plus sign-out.
 * Sign-out is a local session clear (the API has no revocation endpoint yet;
 * see auth-context for where a `/auth/logout` call will slot in).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth/auth-context";

function Row({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="flex flex-col gap-1 py-3.5 first:pt-0 last:pb-0">
      <Text variant="bodySm" color="muted">
        {label}
      </Text>
      {badge ? (
        <span>
          <Badge label={badge} tone="primary" />
        </span>
      ) : (
        <Text variant="body">{value}</Text>
      )}
    </div>
  );
}

export function AccountPage() {
  const { user, profileStatus, reloadProfile, signOut } = useAuth();
  const version = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "1.0.0";

  if (!user && profileStatus === "loading") return <LoadingState label="Loading your profile…" />;
  if (!user) {
    return (
      <ErrorState
        title="Couldn’t load your profile"
        description="Check your connection and try again."
        onRetry={reloadProfile}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Text variant="h1" as="h1">
        Account
      </Text>

      <Card>
        <div className="divide-y divide-divider">
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Username" value={user.username} />
          <Row label="Role" value={user.role ?? "—"} badge={user.role ?? undefined} />
          <Row label="Workspace ID" value={user.tenantId} />
        </div>
      </Card>

      <div className="flex flex-col items-start gap-3">
        <Button variant="destructive" onClick={signOut}>
          Sign out
        </Button>
        <Text variant="caption" color="muted">
          GreatSales Admin · v{version}
        </Text>
      </div>
    </div>
  );
}
