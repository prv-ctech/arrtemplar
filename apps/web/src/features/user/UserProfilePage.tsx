import { ShieldCheckIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManageUsers, hasRequiredPermission } from "@/features/auth/auth-state";
import { getManagedUserProfile } from "@/lib/api";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { managedUserProfileQueryKey } from "./user-profile-cache";

export function UserProfilePage() {
  const actor = useAuthenticatedRouteUser();
  const { publicUserId } = useParams({ from: "/users/$publicUserId" });
  const canReadManagedProfile = canManageUsers(actor);
  const userQuery = useQuery({
    queryKey: managedUserProfileQueryKey(publicUserId),
    queryFn: () => getManagedUserProfile(publicUserId),
  });

  if (!canReadManagedProfile) {
    return (
      <Card className="border-dashed bg-card/54 shadow-(--shadow-soft)">
        <CardHeader>
          <CardTitle>User profile unavailable</CardTitle>
          <CardDescription>
            The requested user profile is not available for the signed-in account.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (userQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading user profile…</p>;
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <Card className="border-dashed bg-card/54 shadow-(--shadow-soft)">
        <CardHeader>
          <CardTitle>User profile unavailable</CardTitle>
          <CardDescription>
            The requested user profile could not be loaded or you no longer have access.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const user = userQuery.data;

  return (
    <div className="space-y-6">
      <Card className="shadow-(--shadow-panel)">
        <CardHeader>
          <CardTitle>{user.username}</CardTitle>
          <CardDescription>
            Managed user profile for cross-user support and administration.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card/72 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Email
            </p>
            <p className="mt-2 text-sm text-foreground">{user.email}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/72 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Public ID
            </p>
            <p className="mt-2 font-mono text-sm text-foreground">{user.id}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/72 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Status
            </p>
            <p className="mt-2 text-sm text-foreground">
              {user.disabledAt ? "Disabled" : "Active"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/72 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Permissions
            </p>
            <p className="mt-2 text-sm text-foreground">{user.permissions.length} active</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {hasRequiredPermission(actor, "users:update") ? (
          <Button asChild type="button">
            <Link params={{ publicUserId: user.id }} to="/users/$publicUserId/settings/main">
              Edit Settings
            </Link>
          </Button>
        ) : null}
        {hasRequiredPermission(actor, "users:password") ? (
          <Button asChild type="button" variant="outline">
            <Link params={{ publicUserId: user.id }} to="/users/$publicUserId/settings/password">
              Change Password
            </Link>
          </Button>
        ) : null}
        {hasRequiredPermission(actor, "users:permissions") ? (
          <Button asChild type="button" variant="outline">
            <Link params={{ publicUserId: user.id }} to="/users/$publicUserId/settings/permissions">
              <ShieldCheckIcon aria-hidden="true" className="size-4" />
              Permissions
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
