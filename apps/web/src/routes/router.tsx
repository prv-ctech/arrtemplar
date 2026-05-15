import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { HealthPanel } from "@/features/health/HealthPanel";

function RootLayout() {
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10 lg:px-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">AnimeHub</p>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
              Anime-native media requests, automation, and watching.
            </h1>
            <p className="text-base leading-7 text-muted-foreground sm:text-lg">
              Phase 0 is online: Bun, Elysia, Vite, Tailwind, shadcn/ui structure, TanStack Query,
              TanStack Router, Eden, and shared contracts are wired together.
            </p>
          </div>
        </header>
        <Outlet />
      </div>
    </main>
  );
}

function HomeRoute() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <HealthPanel />
      <div className="rounded-xl border border-border bg-card/70 p-6">
        <h2 className="text-xl font-semibold">Next milestone</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Phase 1 adds Drizzle ORM, Drizzle Kit migrations, Bun SQLite, and the first typed schema
          for users, sessions, anime metadata, and metadata cache tables.
        </p>
      </div>
    </section>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeRoute,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
