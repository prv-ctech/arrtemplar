import { Link } from "@tanstack/react-router";

export function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-5xl font-black tracking-tight text-muted-foreground">404</p>
      <h2 className="mt-4 text-xl font-semibold text-foreground">Admin section not found</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The admin section you're looking for doesn't exist.
      </p>
      <Link
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-(--shadow-button) transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-px"
        to="/admin/general"
      >
        Back to General settings
      </Link>
    </div>
  );
}
