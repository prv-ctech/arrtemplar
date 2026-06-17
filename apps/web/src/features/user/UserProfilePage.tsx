import type {
  ManagedUserProfile,
  ProfileAvatarId,
  ProfileBannerId,
  PublicUser,
} from "@arrtemplar/shared";
import { GearSixIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authQueryKey, canManageUsers, hasRequiredPermission } from "@/features/auth/auth-state";
import { getManagedUserProfile, updateManagedUserProfile, updateUserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { ProfileMediaPickerDialog } from "./ProfileMediaPickerDialog";
import {
  getProfileAvatarOption,
  getProfileBannerOption,
  PROFILE_AVATAR_OPTIONS,
  PROFILE_BANNER_OPTIONS,
} from "./profile-media-options";
import { managedUserProfileQueryKey, syncUpdatedUserProfileCaches } from "./user-profile-cache";

type ProfileDashboardUser = Pick<
  PublicUser | ManagedUserProfile,
  | "avatarId"
  | "bannerId"
  | "createdAt"
  | "email"
  | "id"
  | "lastLoginAt"
  | "permissions"
  | "username"
> & {
  disabledAt?: string | null;
};

type ProfileMediaActions = {
  isSaving: boolean;
  onAvatarSelect: (avatarId: ProfileAvatarId) => Promise<void>;
  onBannerSelect: (bannerId: ProfileBannerId) => Promise<void>;
};

type ActivityInsight = {
  label: string;
  value: string;
  detail: string;
  values: number[];
  visual: "bars" | "line";
};

const activityInsights: ActivityInsight[] = [
  {
    label: "Books read",
    value: "42",
    detail: "+6 this month",
    values: [7, 10, 8, 12, 15, 17, 20],
    visual: "line",
  },
  {
    label: "Music listened",
    value: "128h",
    detail: "lo-fi, jazz, synth",
    values: [18, 24, 16, 32, 28, 36, 30],
    visual: "bars",
  },
  {
    label: "Manga watched",
    value: "18",
    detail: "placeholder arcs",
    values: [4, 7, 5, 9, 11, 8, 13],
    visual: "line",
  },
  {
    label: "Recently read",
    value: "7",
    detail: "chapters saved",
    values: [3, 5, 4, 8, 6, 10, 7],
    visual: "bars",
  },
];

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleDateString();
}

function MiniLineChart({ values }: { values: number[] }) {
  const width = 180;
  const height = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - 4 - ((value - min) / range) * (height - 10);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      className="h-11 w-full text-primary"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polygon
        fill="currentColor"
        opacity="0.12"
        points={`0,${height} ${points} ${width},${height}`}
      />
      <polyline
        fill="none"
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function MiniBarChart({ values }: { values: number[] }) {
  const width = 180;
  const height = 44;
  const slotWidth = width / values.length;
  const barWidth = Math.max(slotWidth - 5, 8);
  const max = Math.max(...values, 1);

  return (
    <svg
      aria-hidden="true"
      className="h-11 w-full text-primary"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      {values.map((value, index) => {
        const barHeight = Math.max((value / max) * (height - 8), 6);
        const x = index * slotWidth + (slotWidth - barWidth) / 2;
        const y = height - barHeight;

        return (
          <rect
            fill="currentColor"
            height={barHeight}
            key={`bar-${value}-${x.toFixed(1)}`}
            opacity={index === values.length - 1 ? 0.95 : 0.32 + index * 0.08}
            rx="3"
            width={barWidth}
            x={x}
            y={y}
          />
        );
      })}
    </svg>
  );
}

function ActivityInsightCard({ detail, label, value, values, visual }: ActivityInsight) {
  return (
    <article className="min-w-0 rounded-xl border border-border bg-background/34 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{label}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <p className="shrink-0 text-lg font-semibold tracking-tight text-foreground">{value}</p>
      </div>
      <div className="mt-3 rounded-lg bg-card/68 px-2 py-2">
        {visual === "line" ? <MiniLineChart values={values} /> : <MiniBarChart values={values} />}
      </div>
    </article>
  );
}

function ProfileFact({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 bg-card/78 px-3 py-2.5">
      <dt className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "mt-1 truncate font-mono text-xs text-foreground sm:text-sm"
            : "mt-1 truncate text-sm font-semibold text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function ProfileDashboard({
  action,
  mediaActions,
  user,
}: {
  action: ReactNode;
  mediaActions?: ProfileMediaActions | undefined;
  user: ProfileDashboardUser;
}) {
  const avatar = getProfileAvatarOption(user.avatarId);
  const banner = getProfileBannerOption(user.bannerId);

  const bannerImage = (
    <>
      <img alt={banner.alt} className="size-full object-cover" decoding="async" src={banner.src} />
      <div className="absolute inset-0 bg-linear-to-t from-card via-card/20 to-transparent" />
    </>
  );
  const avatarImage = (
    <img alt={avatar.alt} className="size-full object-cover" decoding="async" src={avatar.src} />
  );

  return (
    <section className="-mx-4 -my-5 min-h-[calc(100dvh-4.25rem)] overflow-hidden bg-card/82 sm:-mx-6 lg:-mx-8 lg:-my-7 lg:min-h-dvh">
      <div className="relative h-40 overflow-hidden sm:h-52 lg:h-56">
        {mediaActions ? (
          <ProfileMediaPickerDialog
            disabled={mediaActions.isSaving}
            kind="banner"
            onSelect={(id) => mediaActions.onBannerSelect(id as ProfileBannerId)}
            options={PROFILE_BANNER_OPTIONS}
            selectedId={banner.id}
            trigger={
              <button
                aria-label="Change profile banner"
                className="group relative size-full cursor-pointer overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-70"
                disabled={mediaActions.isSaving}
                type="button"
              >
                {bannerImage}
                <span className="absolute right-3 bottom-3 rounded-full border border-border bg-background/78 px-2 py-1 text-xs font-medium text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  Change banner
                </span>
              </button>
            }
          />
        ) : (
          bannerImage
        )}
      </div>

      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-12">
          {mediaActions ? (
            <ProfileMediaPickerDialog
              disabled={mediaActions.isSaving}
              kind="avatar"
              onSelect={(id) => mediaActions.onAvatarSelect(id as ProfileAvatarId)}
              options={PROFILE_AVATAR_OPTIONS}
              selectedId={avatar.id}
              trigger={
                <button
                  aria-label="Change profile avatar"
                  className={cn(
                    "group relative size-24 shrink-0 cursor-pointer overflow-hidden rounded-full border-4 border-card bg-background shadow-(--shadow-soft)",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-70 sm:size-28",
                  )}
                  disabled={mediaActions.isSaving}
                  type="button"
                >
                  {avatarImage}
                  <span className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-[0.65rem] font-medium text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Change
                  </span>
                </button>
              }
            />
          ) : (
            <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-4 border-card bg-background shadow-(--shadow-soft) sm:size-28">
              {avatarImage}
            </div>
          )}
          <div className="pb-1 sm:pb-2">{action}</div>
        </div>

        <div className="mt-3">
          <div className="min-w-0">
            <h1 className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              Profile dashboard
            </h1>
          </div>
        </div>

        <dl className="mt-5 grid overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <ProfileFact label="Email" value={user.email} />
          <ProfileFact label="Public ID" mono value={user.id} />
          <ProfileFact label="Joined" value={formatDate(user.createdAt)} />
          <ProfileFact label="Permissions" value={`${user.permissions.length} grants`} />
        </dl>

        <div className="mt-5 border-t border-border pt-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Personal activity
              </h2>
              <p className="text-sm text-muted-foreground">
                Placeholder visuals for future media stats.
              </p>
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Sample data
            </p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {activityInsights.map((insight) => (
              <ActivityInsightCard key={insight.label} {...insight} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PersonalProfileRoute() {
  const user = useAuthenticatedRouteUser();
  const queryClient = useQueryClient();
  const mediaMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: async (updatedProfile) => {
      syncUpdatedUserProfileCaches(queryClient, updatedProfile);
      await queryClient.invalidateQueries({ queryKey: authQueryKey });
      toast.success("Profile media updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Profile media update failed.");
    },
  });

  return (
    <ProfileDashboard
      action={
        <Button
          asChild
          className="h-8 rounded-xl px-2.5 text-xs shadow-none sm:h-9 sm:px-3"
          type="button"
        >
          <Link to="/profile/settings/main">
            <GearSixIcon aria-hidden="true" className="size-4" />
            Edit Profile
          </Link>
        </Button>
      }
      mediaActions={
        hasRequiredPermission(user, "profile:update")
          ? {
              isSaving: mediaMutation.isPending,
              onAvatarSelect: async (avatarId) => {
                await mediaMutation.mutateAsync({ avatarId });
              },
              onBannerSelect: async (bannerId) => {
                await mediaMutation.mutateAsync({ bannerId });
              },
            }
          : undefined
      }
      user={user}
    />
  );
}

export function UserProfilePage() {
  const actor = useAuthenticatedRouteUser();
  const { publicUserId } = useParams({ from: "/profile/$publicUserId" });
  const queryClient = useQueryClient();
  const isSelfProfile = publicUserId === actor.id;
  const canReadManagedProfile = !isSelfProfile && canManageUsers(actor);
  const canUpdateManagedProfile =
    canReadManagedProfile && hasRequiredPermission(actor, "users:update");
  const {
    data: managedUser,
    isError: isManagedUserError,
    isPending: isManagedUserPending,
  } = useQuery({
    enabled: canReadManagedProfile,
    queryKey: managedUserProfileQueryKey(publicUserId),
    queryFn: () => getManagedUserProfile(publicUserId),
  });
  const managedMediaMutation = useMutation({
    mutationFn: ({
      avatarId,
      bannerId,
    }: {
      avatarId?: ProfileAvatarId;
      bannerId?: ProfileBannerId;
    }) => updateManagedUserProfile(publicUserId, createProfileMediaUpdate(avatarId, bannerId)),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(managedUserProfileQueryKey(publicUserId), updatedUser);
      toast.success("Profile media updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Profile media update failed.");
    },
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
        <div className="flex flex-wrap justify-end gap-2">
          {hasRequiredPermission(actor, "users:update") ? (
            <Button
              asChild
              className="h-8 rounded-xl px-2.5 text-xs shadow-none sm:h-9 sm:px-3"
              type="button"
            >
              <Link
                params={{ publicUserId: managedUser.id }}
                to="/profile/$publicUserId/settings/main"
              >
                <GearSixIcon aria-hidden="true" className="size-4" />
                Edit Profile
              </Link>
            </Button>
          ) : null}
        </div>
      }
      mediaActions={
        canUpdateManagedProfile
          ? {
              isSaving: managedMediaMutation.isPending,
              onAvatarSelect: async (avatarId) => {
                await managedMediaMutation.mutateAsync({ avatarId });
              },
              onBannerSelect: async (bannerId) => {
                await managedMediaMutation.mutateAsync({ bannerId });
              },
            }
          : undefined
      }
      user={managedUser}
    />
  );
}

function createProfileMediaUpdate(
  avatarId?: ProfileAvatarId,
  bannerId?: ProfileBannerId,
): { avatarId?: ProfileAvatarId; bannerId?: ProfileBannerId } {
  const update: { avatarId?: ProfileAvatarId; bannerId?: ProfileBannerId } = {};

  if (avatarId) {
    update.avatarId = avatarId;
  }

  if (bannerId) {
    update.bannerId = bannerId;
  }

  return update;
}
