import type { PublicUser } from "@arrweeb-anime/shared";
import {
  ArrowSquareOutIcon,
  CompassIcon,
  HouseIcon,
  SignOutIcon,
  SlidersHorizontalIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { authQueryKey } from "@/features/auth/auth-state";
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
      icon: <HouseIcon aria-hidden="true" className="size-4" />,
    },
    { label: "Watch", icon: <CompassIcon aria-hidden="true" className="size-4" />, disabled: true },
    {
      label: "Requests",
      icon: <ArrowSquareOutIcon aria-hidden="true" className="size-4" />,
      disabled: true,
    },
    ...(user.role === "admin"
      ? [
          {
            label: "Admin",
            to: "/admin" as const,
            icon: <SlidersHorizontalIcon aria-hidden="true" className="size-4" />,
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-dvh px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="rounded-4xl border border-white/10 bg-white/[0.035] p-1.5 lg:sticky lg:top-5 lg:h-[calc(100dvh-2.5rem)]">
          <div className="flex h-full flex-col rounded-[1.625rem] border border-white/10 bg-card/80 p-4 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)]">
            <div className="space-y-4 border-b border-border/70 pb-5">
              <Badge variant="outline">Arrweeb control</Badge>
              <div>
                <p className="text-xl font-semibold tracking-tight">Anime operations</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Requests, imports, release intelligence, and playback in one shell.
                </p>
              </div>
            </div>
            <nav aria-label="Primary navigation" className="mt-5 grid gap-1">
              {navItems.map((item) =>
                item.to ? (
                  <Link
                    activeProps={{ className: "border-primary/30 bg-primary/15 text-primary" }}
                    className="inline-flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-[background,color,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted/60 hover:text-foreground"
                    key={item.label}
                    to={item.to}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className="inline-flex items-center justify-between gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground/65"
                    key={item.label}
                  >
                    <span className="inline-flex items-center gap-3">
                      {item.icon}
                      {item.label}
                    </span>
                    {item.disabled ? (
                      <span className="text-[10px] uppercase tracking-[0.18em]">Soon</span>
                    ) : null}
                  </span>
                ),
              )}
            </nav>
            <div className="mt-auto pt-5">
              <div className="rounded-2xl border border-border bg-background/45 p-3">
                <div className="flex items-center gap-3">
                  <UserCircleIcon
                    aria-hidden="true"
                    className="size-9 text-primary"
                    weight="duotone"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {user.username}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </div>
                <button
                  className="mt-3 inline-flex h-10 w-full items-center justify-start gap-2 rounded-full border border-border bg-background/40 px-4 py-2 text-sm font-medium text-foreground transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
                  disabled={logoutMutation.isPending}
                  onClick={() => logoutMutation.mutate()}
                  type="button"
                >
                  <SignOutIcon aria-hidden="true" className="size-4" />
                  {logoutMutation.isPending ? "Signing out" : "Sign out"}
                </button>
              </div>
            </div>
          </div>
        </aside>
        <section className="min-w-0 rounded-4xl border border-white/10 bg-background/45 p-4 shadow-[0_40px_100px_-70px_hsl(222_47%_1%)] sm:p-6 lg:p-8">
          <div className={cn("mx-auto max-w-5xl", section === "Admin" ? "max-w-6xl" : undefined)}>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
