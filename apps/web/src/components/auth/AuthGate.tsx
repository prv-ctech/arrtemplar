import type { PublicUser, UserRole } from "@arrtemplar/shared";
import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRequiredRole, useCurrentUserQuery } from "@/features/auth/auth-state";

export function AuthGate({
  children,
  requiredRole,
}: {
  children: (user: PublicUser) => ReactNode;
  requiredRole?: UserRole;
}) {
  const userQuery = useCurrentUserQuery();

  if (userQuery.isPending) {
    return <AuthLoading />;
  }

  if (userQuery.isError) {
    return <AuthError onRetry={() => userQuery.refetch()} />;
  }

  if (!userQuery.data) {
    return <Navigate replace to="/login" />;
  }

  if (!hasRequiredRole(userQuery.data, requiredRole)) {
    return <Navigate replace to="/app/dashboard" />;
  }

  return children(userQuery.data);
}

function AuthLoading() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <Card className="w-full max-w-md bg-card/82 shadow-(--shadow-panel)">
        <CardHeader>
          <CardTitle>Restoring session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </main>
  );
}

function AuthError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <Card className="w-full max-w-md border-destructive/35 bg-destructive/10 shadow-(--shadow-panel)">
        <CardHeader>
          <CardTitle>Session check failed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>The API could not confirm your session. Check that the backend is running.</p>
          <Button onClick={onRetry} variant="secondary">
            Retry session check
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
