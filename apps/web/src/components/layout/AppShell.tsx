import type { PublicUser } from "@arrtemplar/shared";
import {
  ArrowSquareOutIcon,
  CompassIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  SignOutIcon,
  SlidersHorizontalIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { toast } from "sonner";
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

type ShellNavItem = {
  label: string;
  to?: "/dashboard" | "/admin";
  icon: ReactNode;
  disabled?: boolean;
};

export function AppShell({
  children,
  section,
  user,
}: {
  children: ReactNode;
  section: string;
  user: PublicUser;
}) {
  const navigate = useNavigate();
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
      to: "/dashboard",
      icon: <HouseIcon aria-hidden="true" className="size-5" />,
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

  return (
    <main className="h-dvh w-full max-w-full overflow-hidden text-foreground">
      <div className="mx-auto grid h-dvh max-w-420 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[4.75rem_minmax(0,1fr)]">
        {/* ── Main header (mobile: top bar / desktop: sidebar) ── */}
        <aside className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_srgb,var(--ctp-crust)_84%,transparent)] backdrop-blur-lg lg:h-dvh lg:border-r lg:border-b-0">
          <div className="flex h-full items-center justify-between gap-1.5 px-3 py-3 lg:flex-col lg:justify-start lg:px-3 lg:py-4">
            {/* Top: logo + nav */}
            <div className="flex items-center gap-1.5 lg:flex-col">
              <Link
                aria-label="Open dashboard"
                className="group grid size-11 shrink-0 place-items-center rounded-[1.15rem] bg-primary text-primary-foreground shadow-(--shadow-button) transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:translate-y-px"
                to="/dashboard"
              >
                <span className="text-sm font-black tracking-[-0.08em]">AW</span>
              </Link>
              <nav
                aria-label="Primary navigation"
                className="flex min-w-0 flex-1 items-center justify-center gap-1.5 lg:mt-7 lg:flex-none lg:flex-col"
              >
                {navItems.map((item) =>
                  item.to ? (
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
                  ) : (
                    <span
                      aria-disabled={item.disabled}
                      className="group relative grid size-10 place-items-center rounded-2xl border border-transparent text-muted-foreground/50"
                      key={item.label}
                      title={`${item.label} staged`}
                    >
                      {item.icon}
                      <span className="sr-only">{item.label}</span>
                    </span>
                  ),
                )}
              </nav>
            </div>

            {/* Bottom / end: theme + profile */}
            <div className="flex items-center gap-1.5 lg:mt-auto lg:flex-col lg:gap-2">
              <ThemeSwitcher compact />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={`Open account menu for ${user.username}`}
                    className="grid size-10 place-items-center rounded-2xl border border-border bg-card/76 text-muted-foreground shadow-(--shadow-soft) transition-[background,border-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent hover:text-foreground active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                  >
                    <UserCircleIcon
                      aria-hidden="true"
                      className="size-5 text-primary"
                      weight="duotone"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-72"
                  side="right"
                >
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
                  <DropdownMenuItem
                    disabled={logoutMutation.isPending}
                    onSelect={() => logoutMutation.mutate()}
                  >
                    <SignOutIcon aria-hidden="true" className="size-4" />
                    {logoutMutation.isPending ? "Signing out" : "Sign out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>

        {/* ── Content area ── */}
        <section className="min-w-0 min-h-0 overflow-y-auto lg:h-dvh overscroll-contain">
          {/* Desktop-only header with full-width search bar */}
          <header className="sticky top-0 z-20 hidden border-b border-border bg-background/92 backdrop-blur-lg lg:block">
            <div className="mx-auto max-w-370 px-4 py-3 sm:px-6 lg:px-8">
              <search
                aria-label="Search surface staged for upcoming modules"
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/76 px-4 py-2.5 text-sm text-muted-foreground shadow-(--shadow-soft)"
              >
                <MagnifyingGlassIcon aria-hidden="true" className="size-4 text-primary" />
                <span className="min-w-0 flex-1 truncate">
                  Search titles, requests, import notes
                </span>
                <kbd className="rounded-md border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  /
                </kbd>
              </search>
            </div>
          </header>
          <div
            className={cn(
              "mx-auto max-w-370 px-4 py-5 sm:px-6 lg:px-8 lg:py-7",
              section === "Admin" ? "max-w-370" : undefined,
            )}
          >
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
