import type {
  ManagedUserProfile,
  ProfileAvatarId,
  ProfileBannerId,
  PublicUser,
} from "@arrtemplar/shared";
import { GearSixIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authQueryKey, canManageUsers, hasRequiredPermission } from "@/features/auth/auth-state";
import {
  getProfileAvatarOption,
  getProfileBannerOption,
  PROFILE_AVATAR_OPTIONS,
  PROFILE_BANNER_OPTIONS,
} from "@/features/user/profile-media-options";
import { getManagedUserProfile, updateManagedUserProfile, updateUserProfile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { ProfileMediaPickerDialog } from "./ProfileMediaPickerDialog";
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

type ProfileMediaTriggerButtonProps = ComponentProps<"button"> & {
  children: ReactNode;
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
    <img
      alt={banner.alt}
      className="pointer-events-none size-full object-cover"
      decoding="async"
      src={banner.src}
    />
  );
  const avatarImage = (
    <img
      alt={avatar.alt}
      className="pointer-events-none size-full object-cover"
      decoding="async"
      src={avatar.src}
    />
  );

  return (
    <section className="-mx-4 -my-5 min-h-[calc(100dvh-4.25rem)] overflow-hidden bg-card/82 sm:-mx-6 lg:-mx-8 lg:-my-7 lg:min-h-dvh">
      <ProfileBanner bannerImage={bannerImage} mediaActions={mediaActions} selectedId={banner.id} />

      <div className="border-t border-border/70 px-4 pb-4 sm:px-6 sm:pb-6">
        <ProfileAvatarRow
          action={action}
          avatarImage={avatarImage}
          mediaActions={mediaActions}
          selectedId={avatar.id}
        />
        <ProfileDashboardTitle />
        <ProfileFacts user={user} />
        <ProfileActivitySection />
      </div>
    </section>
  );
}

function ProfileBanner({
  bannerImage,
  mediaActions,
  selectedId,
}: {
  bannerImage: ReactNode;
  mediaActions?: ProfileMediaActions | undefined;
  selectedId: ProfileBannerId;
}) {
  return (
    <div className="relative h-40 overflow-hidden sm:h-52 lg:h-56">
      {mediaActions ? (
        <ProfileMediaPickerDialog
          disabled={mediaActions.isSaving}
          kind="banner"
          onSelect={(id) => mediaActions.onBannerSelect(id as ProfileBannerId)}
          options={PROFILE_BANNER_OPTIONS}
          selectedId={selectedId}
          trigger={
            <ProfileBannerButton disabled={mediaActions.isSaving}>
              {bannerImage}
            </ProfileBannerButton>
          }
        />
      ) : (
        bannerImage
      )}
    </div>
  );
}

function ProfileBannerButton({
  children,
  className,
  ref,
  type = "button",
  ...props
}: ProfileMediaTriggerButtonProps) {
  return (
    <button
      {...props}
      aria-label="Change profile banner"
      className={cn(
        "group relative size-full cursor-pointer overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-70",
        className,
      )}
      ref={ref}
      type={type}
    >
      {children}
      <span className="pointer-events-none absolute right-4 bottom-4 rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Change banner
      </span>
    </button>
  );
}

function ProfileAvatarRow({
  action,
  avatarImage,
  mediaActions,
  selectedId,
}: {
  action: ReactNode;
  avatarImage: ReactNode;
  mediaActions?: ProfileMediaActions | undefined;
  selectedId: ProfileAvatarId;
}) {
  return (
    <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-12">
      <ProfileAvatar
        avatarImage={avatarImage}
        mediaActions={mediaActions}
        selectedId={selectedId}
      />
      <div className="pb-1 sm:pb-2">{action}</div>
    </div>
  );
}

function ProfileAvatar({
  avatarImage,
  mediaActions,
  selectedId,
}: {
  avatarImage: ReactNode;
  mediaActions?: ProfileMediaActions | undefined;
  selectedId: ProfileAvatarId;
}) {
  if (!mediaActions) {
    return (
      <div className="relative size-24 shrink-0 rounded-full bg-card p-1 shadow-(--shadow-soft) sm:size-28">
        <div className="size-full overflow-hidden rounded-full bg-background">{avatarImage}</div>
      </div>
    );
  }

  return (
    <ProfileMediaPickerDialog
      disabled={mediaActions.isSaving}
      kind="avatar"
      onSelect={(id) => mediaActions.onAvatarSelect(id as ProfileAvatarId)}
      options={PROFILE_AVATAR_OPTIONS}
      selectedId={selectedId}
      trigger={
        <ProfileAvatarButton disabled={mediaActions.isSaving}>{avatarImage}</ProfileAvatarButton>
      }
    />
  );
}

function ProfileAvatarButton({
  children,
  className,
  ref,
  type = "button",
  ...props
}: ProfileMediaTriggerButtonProps) {
  return (
    <button
      {...props}
      aria-label="Change profile avatar"
      className={cn(
        "group relative size-24 shrink-0 cursor-pointer overflow-hidden rounded-full bg-card p-1 shadow-(--shadow-soft)",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-70 sm:size-28",
        className,
      )}
      ref={ref}
      type={type}
    >
      <span className="relative block size-full overflow-hidden rounded-full bg-background">
        {children}
      </span>
      <span className="pointer-events-none absolute inset-0 flex items-end justify-center rounded-full bg-linear-to-t from-card/95 via-background/45 to-transparent px-3 pb-2.5 text-[0.65rem] font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Change
      </span>
    </button>
  );
}

function ProfileDashboardTitle() {
  return (
    <div className="mt-3">
      <div className="min-w-0">
        <h1 className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
          Profile dashboard
        </h1>
      </div>
    </div>
  );
}

function ProfileFacts({ user }: { user: ProfileDashboardUser }) {
  return (
    <dl className="mt-5 grid overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      <ProfileFact label="Email" value={user.email} />
      <ProfileFact label="Public ID" mono value={user.id} />
      <ProfileFact label="Joined" value={formatDate(user.createdAt)} />
      <ProfileFact label="Permissions" value={`${user.permissions.length} grants`} />
    </dl>
  );
}

function ProfileActivitySection() {
  return (
    <div className="mt-5 border-t border-border pt-5">
      <ProfileActivityHeader />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {activityInsights.map((insight) => (
          <ActivityInsightCard key={insight.label} {...insight} />
        ))}
      </div>
    </div>
  );
}

function ProfileActivityHeader() {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Personal activity
        </h2>
        <p className="text-sm text-muted-foreground">Placeholder visuals for future media stats.</p>
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Sample data
      </p>
    </div>
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

  if (publicUserId === actor.id) {
    return <Navigate replace to="/profile" />;
  }

  return <ManagedUserProfileDashboard actor={actor} publicUserId={publicUserId} />;
}

function ManagedUserProfileDashboard({
  actor,
  publicUserId,
}: {
  actor: PublicUser;
  publicUserId: string;
}) {
  const queryClient = useQueryClient();
  const canReadManagedProfile = canManageUsers(actor);
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

  if (!canReadManagedProfile) {
    return <ManagedProfileUnavailableCard reason="permission" />;
  }

  if (isManagedUserPending) {
    return <p className="text-sm text-muted-foreground">Loading user profile…</p>;
  }

  if (isManagedUserError || !managedUser) {
    return <ManagedProfileUnavailableCard reason="load" />;
  }

  return (
    <ProfileDashboard
      action={<ManagedProfileAction actor={actor} publicUserId={managedUser.id} />}
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

function ManagedProfileUnavailableCard({ reason }: { reason: "load" | "permission" }) {
  return (
    <Card className="border-dashed bg-card/54 shadow-(--shadow-soft)">
      <CardHeader>
        <CardTitle>User profile unavailable</CardTitle>
        <CardDescription>{getManagedProfileUnavailableMessage(reason)}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function getManagedProfileUnavailableMessage(reason: "load" | "permission") {
  if (reason === "permission") {
    return "The requested user profile is not available for the signed-in account.";
  }

  return "The requested user profile could not be loaded or you no longer have access.";
}

function ManagedProfileAction({
  actor,
  publicUserId,
}: {
  actor: PublicUser;
  publicUserId: string;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {hasRequiredPermission(actor, "users:update") ? (
        <Button
          asChild
          className="h-8 rounded-xl px-2.5 text-xs shadow-none sm:h-9 sm:px-3"
          type="button"
        >
          <Link params={{ publicUserId }} to="/profile/$publicUserId/settings/main">
            <GearSixIcon aria-hidden="true" className="size-4" />
            Edit Profile
          </Link>
        </Button>
      ) : null}
    </div>
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
