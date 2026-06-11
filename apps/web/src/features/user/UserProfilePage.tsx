import type { ManagedUserProfile, PublicUser } from "@arrtemplar/shared";
import { CalendarCheckIcon, ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManageUsers, hasRequiredPermission } from "@/features/auth/auth-state";
import { getManagedUserProfile } from "@/lib/api";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { managedUserProfileQueryKey } from "./user-profile-cache";

type ProfileDashboardUser = Pick<
  PublicUser | ManagedUserProfile,
  "createdAt" | "email" | "id" | "lastLoginAt" | "permissions" | "username"
> & {
  disabledAt?: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleDateString();
}

function ProfileMetric({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card/72 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={
          mono
            ? "mt-2 truncate font-mono text-sm text-foreground"
            : "mt-2 truncate text-sm font-semibold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

function ProfileDashboard({
  action,
  description,
  title,
  user,
}: {
  action: ReactNode;
  description: string;
  title: string;
  user: ProfileDashboardUser;
}) {
  const status = user.disabledAt ? "Disabled" : "Active";

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-border bg-card/78 p-5 shadow-(--shadow-soft) sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge>Profile dashboard</Badge>
            <h1 className="mt-3 truncate text-2xl font-semibold tracking-[-0.04em] text-foreground">
              {title}
            </h1>
            <p className="mt-2 max-w-[58ch] text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          {action}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProfileMetric label="Username" value={user.username} />
          <ProfileMetric label="Email" value={user.email} />
          <ProfileMetric label="Public ID" mono value={user.id} />
          <ProfileMetric label="Permissions" value={`${user.permissions.length} active`} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="shadow-(--shadow-panel)">
          <CardHeader>
            <CardTitle>Account state</CardTitle>
            <CardDescription>Quick status details for this profile.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card/72 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Status
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{status}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card/72 p-4">
              <CalendarCheckIcon aria-hidden="true" className="size-4 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">Joined</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatDate(user.createdAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/72 p-4">
              <ClockCounterClockwiseIcon aria-hidden="true" className="size-4 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">Last login</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatDate(user.lastLoginAt)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-(--shadow-panel)">
          <CardHeader>
            <CardTitle>Personal activity</CardTitle>
            <CardDescription>Mini dashboard context for this user.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border rounded-3xl border border-border bg-background/48">
              {["Profile identity", "Security", "Permissions"].map((label) => (
                <div className="grid gap-1 p-4 sm:grid-cols-[9rem_minmax(0,1fr)]" key={label}>
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {label === "Profile identity"
                      ? "Name and email are available from profile settings."
                      : label === "Security"
                        ? "Password changes stay isolated from app-wide settings."
                        : "Permission grants explain the surfaces available to this account."}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function PersonalProfileRoute() {
  const user = useAuthenticatedRouteUser();

  return (
    <ProfileDashboard
      action={
        <Button asChild type="button">
          <Link to="/profile/settings/main">Profile Settings</Link>
        </Button>
      }
      description="Your personal dashboard keeps account context separate from profile settings."
      title={`Welcome back, ${user.username}`}
      user={user}
    />
  );
}

export function UserProfilePage() {
  const actor = useAuthenticatedRouteUser();
  const { publicUserId } = useParams({ from: "/profile/$publicUserId" });
  const isSelfProfile = publicUserId === actor.id;
  const canReadManagedProfile = !isSelfProfile && canManageUsers(actor);
  const {
    data: managedUser,
    isError: isManagedUserError,
    isPending: isManagedUserPending,
  } = useQuery({
    enabled: canReadManagedProfile,
    queryKey: managedUserProfileQueryKey(publicUserId),
    queryFn: () => getManagedUserProfile(publicUserId),
  });

  if (isSelfProfile) {
    return <Navigate replace to="/profile" />;
  }

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

  if (isManagedUserPending) {
    return <p className="text-sm text-muted-foreground">Loading user profile…</p>;
  }

  if (isManagedUserError || !managedUser) {
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

  return (
    <ProfileDashboard
      action={
        <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
          {hasRequiredPermission(actor, "users:update") ? (
            <Button asChild type="button">
              <Link
                params={{ publicUserId: managedUser.id }}
                to="/profile/$publicUserId/settings/main"
              >
                Profile Settings
              </Link>
            </Button>
          ) : null}
        </div>
      }
      description="Managed profile dashboard for cross-user support and administration."
      title={managedUser.username}
      user={managedUser}
    />
  );
}
