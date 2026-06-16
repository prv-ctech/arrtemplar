import type { ManagedUserProfile, PublicUser } from "@arrtemplar/shared";
import { GearSixIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type ActivityInsight = {
  label: string;
  value: string;
  detail: string;
  values: number[];
  visual: "bars" | "line";
};

const profileBannerSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 420">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#ff79c6"/>
      <stop offset="0.45" stop-color="#bd93f9"/>
      <stop offset="1" stop-color="#8be9fd"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" x2="1">
      <stop offset="0" stop-color="#50fa7b" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#f1fa8c" stop-opacity="0.25"/>
    </linearGradient>
  </defs>
  <rect width="1440" height="420" fill="#1e2029"/>
  <path d="M0 118c175 60 303 65 496 16 210-53 370-41 557 80 146 94 270 128 387 105V0H0Z" fill="url(#sky)"/>
  <path d="M0 298c188-84 383-90 584-18 166 60 312 59 476-5 135-53 259-67 380-29v174H0Z" fill="url(#glow)"/>
  <circle cx="1085" cy="94" r="164" fill="#f8f8f2" opacity="0.12"/>
  <circle cx="1250" cy="244" r="72" fill="#282a36" opacity="0.28"/>
</svg>`);

const profileAvatarSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <defs>
    <linearGradient id="hair" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#8be9fd"/>
      <stop offset="0.5" stop-color="#bd93f9"/>
      <stop offset="1" stop-color="#ff79c6"/>
    </linearGradient>
  </defs>
  <rect width="240" height="240" rx="120" fill="#282a36"/>
  <circle cx="120" cy="96" r="58" fill="url(#hair)"/>
  <path d="M54 203c10-48 43-77 66-77s56 29 66 77" fill="#f8f8f2" opacity="0.92"/>
  <circle cx="101" cy="105" r="8" fill="#282a36"/>
  <circle cx="139" cy="105" r="8" fill="#282a36"/>
  <path d="M102 132c12 10 25 10 37 0" fill="none" stroke="#282a36" stroke-linecap="round" stroke-width="8"/>
</svg>`);

const PROFILE_BANNER_PLACEHOLDER = `data:image/svg+xml;utf8,${profileBannerSvg}`;
const PROFILE_AVATAR_PLACEHOLDER = `data:image/svg+xml;utf8,${profileAvatarSvg}`;

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

function ProfileDashboard({ action, user }: { action: ReactNode; user: ProfileDashboardUser }) {
  return (
    <section className="-mx-4 -my-5 min-h-[calc(100dvh-4.25rem)] overflow-hidden bg-card/82 sm:-mx-6 lg:-mx-8 lg:-my-7 lg:min-h-dvh">
      <div className="relative h-28 overflow-hidden sm:h-36">
        <img
          alt=""
          className="size-full object-cover"
          decoding="async"
          src={PROFILE_BANNER_PLACEHOLDER}
        />
        <div className="absolute inset-0 bg-linear-to-t from-card via-card/20 to-transparent" />
      </div>

      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-12">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-4 border-card bg-background shadow-(--shadow-soft) sm:size-28">
            <img
              alt="Placeholder profile avatar"
              className="size-full object-cover"
              decoding="async"
              src={PROFILE_AVATAR_PLACEHOLDER}
            />
          </div>
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
      user={managedUser}
    />
  );
}
