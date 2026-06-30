import { Link } from "@tanstack/react-router";

export function RootNotFoundRoute() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-4xl border border-border bg-card/78 p-6 text-center shadow-(--shadow-soft)">
        <p className="text-sm font-medium text-primary">Route not found</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
          This page is no longer available.
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          User management now lives in Settings, and profile dashboards live under Profile.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-(--shadow-button) transition-colors duration-300 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/settings/users"
          >
            Open Users
          </Link>
          <Link
            className="rounded-2xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/profile"
          >
            Open Profile
          </Link>
        </div>
      </section>
    </main>
  );
}
