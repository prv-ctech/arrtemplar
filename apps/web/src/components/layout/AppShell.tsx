import type { PublicUser } from "@arrtemplar/shared";
import {
  ArrowSquareOutIcon,
  CompassIcon,
  GearIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  SignOutIcon,
  SlidersHorizontalIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type ComponentProps, type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authQueryKey } from "@/features/auth/auth-state";
import { ThemeSwitcher } from "@/features/theme/ThemeSwitcher";
import { logout } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type ShellNavLinkItem = {
  label: string;
  to: "/app/dashboard" | "/account" | "/admin";
  icon: ReactNode;
};

type ShellDisabledNavItem = {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
};

type ShellNavItem = ShellNavLinkItem | ShellDisabledNavItem;

type AccountMenuSide = ComponentProps<typeof DropdownMenuContent>["side"];

type ShellActionsProps = {
  accountMenuSide?: AccountMenuSide;
  className?: string;
  isSigningOut: boolean;
  onSignOut: () => void;
  user: PublicUser;
};

function ShellActions({
  accountMenuSide = "bottom",
  className,
  isSigningOut,
  onSignOut,
  user,
}: ShellActionsProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <ThemeSwitcher compact />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Open account menu for ${user.username}`}
            className="grid size-10 place-items-center rounded-2xl border border-border bg-card/76 text-muted-foreground shadow-(--shadow-soft) transition-[background,border-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent hover:text-foreground active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            <UserCircleIcon aria-hidden="true" className="size-5 text-primary" weight="duotone" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72" side={accountMenuSide}>
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-semibold text-foreground">
              {user.username}
            </span>
            <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="justify-between" disabled>
            Role
            <span className="rounded-lg border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground">
              {user.role}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={isSigningOut} onSelect={onSignOut}>
            <SignOutIcon aria-hidden="true" className="size-4" />
            {isSigningOut ? "Signing out" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AppShell({ children, user }: { children: ReactNode; user: PublicUser }) {
  const navigate = useNavigate();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const focusMobileSearchInput = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.setQueryData(authQueryKey, null);
      toast.success("Signed out.");
      navigate({ to: "/login" });
    },
  });

  const navItems: ShellNavItem[] = [
    {
      label: "Dashboard",
      to: "/app/dashboard",
      icon: <HouseIcon aria-hidden="true" className="size-5" />,
    },
    {
      label: "Settings",
      to: "/account",
      icon: <GearIcon aria-hidden="true" className="size-5" />,
    },
    { label: "Watch", icon: <CompassIcon aria-hidden="true" className="size-5" />, disabled: true },
    {
      label: "Requests",
      icon: <ArrowSquareOutIcon aria-hidden="true" className="size-5" />,
      disabled: true,
    },
    ...(user.role === "admin"
      ? [
          {
            label: "Admin",
            to: "/admin" as const,
            icon: <SlidersHorizontalIcon aria-hidden="true" className="size-5" />,
          },
        ]
      : []),
  ];

  const handleMobileSearchToggle = () => {
    setIsMobileSearchOpen((currentValue) => !currentValue);
  };

  const handleSignOut = () => {
    logoutMutation.mutate();
  };

  return (
    <main className="h-dvh w-full max-w-full overflow-hidden text-foreground">
      <div className="grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[4.75rem_minmax(0,1fr)]">
        {/* ── Main header (mobile: top bar / desktop: sidebar) ── */}
        <aside className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_srgb,var(--ctp-crust)_84%,transparent)] backdrop-blur-lg lg:h-dvh lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-1.5 px-3 py-3 lg:h-full lg:flex-col lg:justify-start lg:px-3 lg:py-4">
            {/* Top: logo + nav */}
            <div className="flex items-center gap-1.5 lg:flex-col">
              <Link
                aria-label="Open dashboard"
                className="group grid size-11 shrink-0 place-items-center rounded-[1.15rem] bg-primary text-primary-foreground shadow-(--shadow-button) transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:translate-y-px"
                to="/app/dashboard"
              >
                <span className="text-sm font-black tracking-[-0.08em]">AW</span>
              </Link>
              <nav
                aria-label="Primary navigation"
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 lg:mt-7 lg:flex-none lg:flex-col"
              >
                {navItems.map((item) => {
                  if (!("to" in item)) {
                    return (
                      <span
                        aria-disabled={item.disabled}
                        className="group relative grid size-10 place-items-center rounded-2xl border border-transparent text-muted-foreground/50"
                        key={item.label}
                        title={`${item.label} staged`}
                      >
                        {item.icon}
                        <span className="sr-only">{item.label}</span>
                      </span>
                    );
                  }
                  return (
                    <Link
                      activeProps={{
                        className:
                          "border-primary/35 bg-primary text-primary-foreground shadow-(--shadow-button)",
                      }}
                      aria-label={item.label}
                      className="group relative grid size-10 place-items-center rounded-2xl border border-transparent text-muted-foreground transition-[background,color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-border hover:bg-card hover:text-foreground active:translate-y-px"
                      key={item.label}
                      title={item.label}
                      to={item.to}
                    >
                      {item.icon}
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  );
                })}
                <Button
                  aria-controls="mobile-shell-search"
                  aria-expanded={isMobileSearchOpen}
                  aria-label={isMobileSearchOpen ? "Close mobile search" : "Open mobile search"}
                  className="shrink-0 px-0 lg:hidden"
                  onClick={handleMobileSearchToggle}
                  size="icon"
                  type="button"
                  variant={isMobileSearchOpen ? "default" : "outline"}
                >
                  <MagnifyingGlassIcon
                    aria-hidden="true"
                    className={cn("size-4", isMobileSearchOpen ? undefined : "text-primary")}
                  />
                </Button>
              </nav>
            </div>

            {/* End actions: mobile shell header only */}
            <ShellActions
              accountMenuSide="right"
              className="lg:hidden"
              isSigningOut={logoutMutation.isPending}
              onSignOut={handleSignOut}
              user={user}
            />
          </div>
          {isMobileSearchOpen ? (
            <search
              aria-label="Mobile search surface staged for upcoming modules"
              className="px-3 pt-2 pb-3 lg:hidden"
              id="mobile-shell-search"
            >
              <div className="rounded-[1.35rem] border border-border bg-[color-mix(in_srgb,var(--ctp-crust)_92%,transparent)] p-3 shadow-(--shadow-soft) backdrop-blur-xl">
                <label className="sr-only" htmlFor="mobile-shell-search-input">
                  Search titles, requests, import notes
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/76 px-3 py-2.5 text-sm text-muted-foreground shadow-(--shadow-soft)">
                  <MagnifyingGlassIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-primary"
                  />
                  <input
                    aria-describedby="mobile-shell-search-hint"
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    id="mobile-shell-search-input"
                    placeholder="Search titles, requests, import notes"
                    ref={focusMobileSearchInput}
                    type="search"
                  />
                </div>
                <div
                  className="mt-3 rounded-2xl border border-dashed border-border bg-card/42 p-3"
                  id="mobile-shell-search-hint"
                >
                  <p className="text-sm font-semibold text-foreground">Search UI template</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Search results will appear here once modules are connected.
                  </p>
                </div>
              </div>
            </search>
          ) : null}
        </aside>

        {/* ── Content area ── */}
        <section className="min-w-0 min-h-0 overflow-y-auto lg:h-dvh overscroll-contain">
          {/* Desktop-only header with search and actions */}
          <header className="sticky top-0 z-20 hidden border-b border-border bg-background/92 backdrop-blur-lg lg:block">
            <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <search
                aria-label="Search surface staged for upcoming modules"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-card/76 px-4 py-2.5 text-sm text-muted-foreground shadow-(--shadow-soft)"
              >
                <MagnifyingGlassIcon aria-hidden="true" className="size-4 text-primary" />
                <span className="min-w-0 flex-1 truncate">
                  Search titles, requests, import notes
                </span>
                <kbd className="rounded-md border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  /
                </kbd>
              </search>
              <ShellActions
                className="hidden gap-2 lg:flex"
                isSigningOut={logoutMutation.isPending}
                onSignOut={handleSignOut}
                user={user}
              />
            </div>
          </header>
          <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div>
        </section>
      </div>
    </main>
  );
}
