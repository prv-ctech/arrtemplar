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

  const sectionDescription =
    section === "Admin"
      ? "Import rules, queue pressure, and audit review."
      : "Requests, release signals, health checks, and watchlist movement in one desk.";

  return (
    <main className="min-h-dvh w-full max-w-full overflow-x-hidden text-foreground">
      <div className="mx-auto grid min-h-dvh max-w-420 lg:grid-cols-[4.75rem_minmax(0,1fr)]">
        <aside className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_srgb,var(--ctp-crust)_84%,transparent)] backdrop-blur-2xl lg:h-dvh lg:border-r lg:border-b-0">
          <div className="flex h-full items-center justify-between gap-3 px-3 py-3 lg:flex-col lg:justify-start lg:px-3 lg:py-4">
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
            <span className="hidden h-px w-7 bg-border lg:block" />
          </div>
        </aside>
        <section className="min-w-0">
          <header className="sticky top-[4.35rem] z-20 border-b border-border bg-background/82 backdrop-blur-2xl lg:top-0">
            <div className="mx-auto max-w-370 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    Arrtemplar
                  </p>
                  <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
                    <h1 className="text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">
                      {section}
                    </h1>
                    <p className="pb-1 text-sm leading-6 text-muted-foreground">
                      {sectionDescription}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <search
                    aria-label="Search surface staged for upcoming modules"
                    className="hidden min-w-72 items-center gap-3 rounded-2xl border border-border bg-card/76 px-4 py-2.5 text-sm text-muted-foreground shadow-(--shadow-soft) md:flex"
                  >
                    <MagnifyingGlassIcon aria-hidden="true" className="size-4 text-primary" />
                    <span className="min-w-0 flex-1 truncate">
                      Search titles, requests, import notes
                    </span>
                    <kbd className="rounded-md border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      /
                    </kbd>
                  </search>
                  <ThemeSwitcher />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex h-11 items-center gap-3 rounded-2xl border border-border bg-card/76 px-3 text-left text-sm shadow-(--shadow-soft) transition-[background,border-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        type="button"
                      >
                        <UserCircleIcon
                          aria-hidden="true"
                          className="size-6 text-primary"
                          weight="duotone"
                        />
                        <span className="hidden min-w-0 sm:block">
                          <span className="block max-w-32 truncate font-medium text-foreground">
                            {user.username}
                          </span>
                          <span className="block text-xs text-muted-foreground">{user.role}</span>
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
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
