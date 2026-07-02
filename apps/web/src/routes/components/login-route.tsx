import { Navigate } from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getLandingPathForUser } from "@/features/auth/auth-navigation";
import { useAuthSetupQuery, useCurrentUserQuery } from "@/features/auth/auth-state";
import { useAuthProvidersQuery } from "@/features/auth-settings/auth-settings";

const oidcStartPath = "/api/auth/oauth/oidc/start";
const Particles = lazy(() => import("@/components/Particles"));
const loginParticleColors = ["#ffffff"];

export function LoginRoute() {
  const userQuery = useCurrentUserQuery();
  const setupQuery = useAuthSetupQuery();
  const providersQuery = useAuthProvidersQuery();

  if (userQuery.data) {
    return <Navigate replace to={getLandingPathForUser(userQuery.data)} />;
  }

  if (userQuery.isPending) {
    return <LoginRouteStatus description="Checking session." title="Restoring session" />;
  }

  if (setupQuery.data?.required === false && providersQuery.data === undefined) {
    return providersQuery.isError ? (
      <LoginRouteStatus
        action={
          <Button onClick={() => providersQuery.refetch()} variant="secondary">
            Retry
          </Button>
        }
        description="Provider check failed."
        title="Auth check failed"
      />
    ) : (
      <LoginRouteStatus description="Checking sign-in." title="Checking auth" />
    );
  }

  const oidcProvider = findEnabledOidcProvider(providersQuery.data);

  if (oidcProvider) {
    return <OidcPrimarySignIn buttonText={oidcProvider.buttonText} />;
  }

  return (
    <LoginPageFrame>
      <LoginForm />
    </LoginPageFrame>
  );
}

function findEnabledOidcProvider(providers: ReturnType<typeof useAuthProvidersQuery>["data"]) {
  return providers?.find((provider) => provider.slug === "oidc" && provider.enabled) ?? null;
}

function OidcPrimarySignIn({ buttonText }: { buttonText: string }) {
  return (
    <LoginRouteStatus
      action={
        <Button asChild className="h-10 rounded-md px-4 font-medium">
          <a href={oidcStartPath}>{buttonText}</a>
        </Button>
      }
      description="Single sign-on is enabled."
      title="Sign in"
    />
  );
}

function LoginRouteStatus({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <LoginPageFrame>
      <Card className="w-full rounded-lg border-border bg-card/92 shadow-none backdrop-blur-xl">
        <CardHeader className="items-center gap-2 p-6 pb-4 text-center">
          <BrandMark />
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </CardHeader>
        <CardContent className="space-y-5 p-6 pt-0 text-center">
          <p className="text-sm text-muted-foreground">{description}</p>
          {action ? <div className="flex justify-center">{action}</div> : null}
        </CardContent>
      </Card>
    </LoginPageFrame>
  );
}

function LoginPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden bg-background px-6 py-10 text-foreground md:px-10">
      <LoginBackground />
      <section className="relative z-10 w-full max-w-sm">{children}</section>
    </main>
  );
}

function LoginBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <Suspense fallback={null}>
        <Particles
          alphaParticles
          cameraDistance={22}
          className="h-full w-full"
          disableRotation
          moveParticlesOnHover={false}
          particleBaseSize={110}
          particleColors={loginParticleColors}
          particleCount={840}
          particleHoverFactor={1}
          particleSpread={21}
          sizeRandomness={1.2}
          speed={0.08}
        />
      </Suspense>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center justify-center gap-2 text-foreground">
      <span className="text-sm font-black tracking-[-0.14em]" aria-hidden="true">
        AW
      </span>
      <span className="text-base font-semibold tracking-tight">Arrtemplar</span>
    </div>
  );
}
