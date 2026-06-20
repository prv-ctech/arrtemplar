import type { PublicUser } from "@arrtemplar/shared";
import {
  GearSixIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authQueryKey, canAccessSettings } from "@/features/auth/auth-state";
import { notify } from "@/features/notifications/notification-gateway";
import { NotificationInboxPopover } from "@/features/notifications/notification-inbox-popover";
import { logout } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { getProfileAvatarOption } from "../../features/user/profile-media-options";

type ShellNavLinkItem = {
  label: string;
  to: "/dashboard";
  icon: ReactNode;
};

const shellNavItems: ShellNavLinkItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: <HouseIcon aria-hidden="true" className="size-5" />,
  },
];

type AccountMenuSide = NonNullable<ComponentProps<typeof DropdownMenuContent>["side"]>;

type ShellActionsProps = {
  accountMenuSide?: AccountMenuSide;
  className?: string;
  isSigningOut: boolean;
  onSignOut: () => void;
  user: PublicUser;
};

type AccountMenuTriggerProps = ComponentProps<"button"> & {
  avatarSrc: string;
  username: string;
};

function ShellActions({
  accountMenuSide = "bottom",
  className,
  isSigningOut,
  onSignOut,
  user,
}: ShellActionsProps) {
  const accountAvatar = getProfileAvatarOption(user.avatarId);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <NotificationInboxPopover />
      <DropdownMenu>
        <AccountMenuTrigger avatarSrc={accountAvatar.src} username={user.username} />
        <AccountMenuContent
          accountMenuSide={accountMenuSide}
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
          user={user}
        />
      </DropdownMenu>
    </div>
  );
}

function AccountMenuTrigger({
  avatarSrc,
  className,
  username,
  type = "button",
}: AccountMenuTriggerProps) {
  return (
    <DropdownMenuTrigger
      aria-label={`Open account menu for ${username}`}
      className={cn(
        "grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-primary/25 bg-background p-0.5 transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      type={type}
    >
      <img
        alt=""
        aria-hidden="true"
        className="pointer-events-none size-full rounded-full object-cover"
        decoding="async"
        src={avatarSrc}
      />
    </DropdownMenuTrigger>
  );
}

function AccountMenuContent({
  accountMenuSide,
  isSigningOut,
  onSignOut,
  user,
}: {
  accountMenuSide: AccountMenuSide;
  isSigningOut: boolean;
  onSignOut: () => void;
  user: PublicUser;
}) {
  return (
    <DropdownMenuContent
      align="end"
      className="w-52 rounded-xl p-1 shadow-(--shadow-soft)"
      side={accountMenuSide}
      sideOffset={10}
    >
      <AccountProfileMenuItem />
      {canAccessSettings(user) ? <AccountSettingsMenuItem /> : null}
      <DropdownMenuSeparator className="my-1" />
      <DropdownMenuItem
        className="px-2.5 py-2 text-muted-foreground focus:text-foreground"
        disabled={isSigningOut}
        onSelect={onSignOut}
      >
        <SignOutIcon aria-hidden="true" className="size-4" />
        {isSigningOut ? "Signing out" : "Sign out"}
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

function AccountProfileMenuItem() {
  return (
    <DropdownMenuItem asChild className="px-2.5 py-2">
      <Link to="/profile">
        <UserCircleIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        My Profile
      </Link>
    </DropdownMenuItem>
  );
}

function AccountSettingsMenuItem() {
  return (
    <DropdownMenuItem asChild className="px-2.5 py-2">
      <Link to="/settings">
        <GearSixIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        Settings
      </Link>
    </DropdownMenuItem>
  );
}

export function AppShell({ children, user }: { children: ReactNode; user: PublicUser }) {
  const navigate = useNavigate();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authQueryKey, null);
      notify(
        {
          id: "auth.signed_out",
          title: "Signed out.",
        },
        user.notificationPreferences,
      );
      navigate({ to: "/login" });
    },
    onError: (error) => {
      notify(
        {
          id: "auth.sign_out.failed",
          title: error instanceof Error ? error.message : "Sign out failed.",
        },
        user.notificationPreferences,
      );
    },
  });

  const handleSignOut = () => {
    logoutMutation.mutate();
  };

  return (
    <main className="h-dvh w-full max-w-full overflow-hidden text-foreground">
      <div className="grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[4.75rem_minmax(0,1fr)]">
        <ShellSidebar
          isSigningOut={logoutMutation.isPending}
          onSignOut={handleSignOut}
          user={user}
        />
        <ShellMainContent
          isSigningOut={logoutMutation.isPending}
          onSignOut={handleSignOut}
          user={user}
        >
          {children}
        </ShellMainContent>
      </div>
    </main>
  );
}

function ShellSidebar({
  isSigningOut,
  onSignOut,
  user,
}: {
  isSigningOut: boolean;
  onSignOut: () => void;
  user: PublicUser;
}) {
  return (
    <aside className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_srgb,var(--catppuccin-color-crust)_84%,transparent)] backdrop-blur-lg lg:h-dvh lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-1.5 px-3 py-3 lg:h-full lg:flex-col lg:justify-start lg:px-3 lg:py-4">
        <ShellNavigation />
        <ShellActions
          accountMenuSide="bottom"
          className="lg:hidden"
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
          user={user}
        />
      </div>
    </aside>
  );
}

function ShellNavigation() {
  return (
    <div className="flex items-center gap-1.5 lg:flex-col">
      <ShellBrandLink />
      <nav
        aria-label="Primary navigation"
        className="flex min-w-0 flex-1 items-center justify-center gap-1.5 lg:mt-7 lg:flex-none lg:flex-col"
      >
        {shellNavItems.map((item) => (
          <ShellNavLink item={item} key={item.label} />
        ))}
      </nav>
    </div>
  );
}

function ShellBrandLink() {
  return (
    <Link
      aria-label="Open dashboard"
      className="group grid size-11 shrink-0 place-items-center rounded-[1.15rem] bg-primary text-primary-foreground shadow-(--shadow-button) transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:translate-y-px"
      to="/dashboard"
    >
      <span className="text-sm font-black tracking-[-0.08em]">AW</span>
    </Link>
  );
}

function ShellNavLink({ item }: { item: ShellNavLinkItem }) {
  return (
    <Link
      activeProps={{
        className: "border-primary/35 bg-primary text-primary-foreground shadow-(--shadow-button)",
      }}
      aria-label={item.label}
      className="group relative grid size-10 place-items-center rounded-2xl border border-transparent text-muted-foreground transition-[background,color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-border hover:bg-card hover:text-foreground active:translate-y-px"
      title={item.label}
      to={item.to}
    >
      {item.icon}
      <span className="sr-only">{item.label}</span>
    </Link>
  );
}

function ShellMainContent({
  children,
  isSigningOut,
  onSignOut,
  user,
}: {
  children: ReactNode;
  isSigningOut: boolean;
  onSignOut: () => void;
  user: PublicUser;
}) {
  return (
    <section className="min-w-0 min-h-0 overflow-y-auto lg:h-dvh overscroll-contain">
      <ShellDesktopHeader isSigningOut={isSigningOut} onSignOut={onSignOut} user={user} />
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div>
    </section>
  );
}

function ShellDesktopHeader({
  isSigningOut,
  onSignOut,
  user,
}: {
  isSigningOut: boolean;
  onSignOut: () => void;
  user: PublicUser;
}) {
  return (
    <header className="sticky top-0 z-20 hidden border-b border-border bg-background/92 backdrop-blur-lg lg:block">
      <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <ShellSearch />
        <ShellActions
          className="hidden gap-2 lg:flex"
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
          user={user}
        />
      </div>
    </header>
  );
}

function ShellSearch() {
  return (
    <search
      aria-label="Search surface staged for upcoming modules"
      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-card/76 px-4 py-2.5 text-sm text-muted-foreground shadow-(--shadow-soft)"
    >
      <MagnifyingGlassIcon aria-hidden="true" className="size-4 text-primary" />
      <span className="min-w-0 flex-1 truncate">Search titles, requests, import notes</span>
      <kbd className="rounded-md border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        /
      </kbd>
    </search>
  );
}
