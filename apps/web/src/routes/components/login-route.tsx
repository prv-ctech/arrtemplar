import { Navigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import { getLandingPathForUser } from "@/features/auth/auth-navigation";
import { useAuthSetupQuery, useCurrentUserQuery } from "@/features/auth/auth-state";
import { useAuthProvidersQuery } from "@/features/auth-settings/auth-settings";

const authentikStartPath = "/api/auth/oauth/authentik/start";

const loginMediaAssets = {
  backdrop: "https://picsum.photos/seed/login-backdrop/1800/1200",
  artwork: "https://picsum.photos/seed/login-panel/1400/1600",
} as const;

export function LoginRoute() {
  const { signedOut } = useSearch({ from: "/login" });
  const shouldForceProviderLogin = signedOut === true;
  const userQuery = useCurrentUserQuery();
  const setupQuery = useAuthSetupQuery();
  const providersQuery = useAuthProvidersQuery();

  if (userQuery.data) {
    return <Navigate replace to={getLandingPathForUser(userQuery.data)} />;
  }

  if (userQuery.isPending) {
    return (
      <LoginRouteStatus description="Checking for an existing session." title="Restoring session" />
    );
  }

  if (setupQuery.data?.required === false && providersQuery.data === undefined) {
    return providersQuery.isError ? (
      <LoginRouteStatus
        action={
          <Button onClick={() => providersQuery.refetch()} variant="secondary">
            Retry provider check
          </Button>
        }
        description="The API could not confirm whether Authentik is enabled."
        title="Authentication check failed"
      />
    ) : (
      <LoginRouteStatus
        description="Checking whether Authentik should handle sign-in."
        title="Checking authentication"
      />
    );
  }

  if (isAuthentikEnabled(providersQuery.data)) {
    return <AuthentikPrimaryRedirect forceProviderLogin={shouldForceProviderLogin} />;
  }

  return (
    <main className="relative isolate min-h-dvh w-full max-w-full overflow-x-hidden bg-background text-foreground">
      <LoginBackdrop />
      <LoginPanel />
    </main>
  );
}

function isAuthentikEnabled(providers: ReturnType<typeof useAuthProvidersQuery>["data"]): boolean {
  return providers?.some((provider) => provider.slug === "authentik" && provider.enabled) ?? false;
}

function AuthentikPrimaryRedirect({ forceProviderLogin }: { forceProviderLogin: boolean }) {
  useEffect(() => {
    window.location.assign(getAuthentikStartPath(forceProviderLogin));
  }, [forceProviderLogin]);

  return (
    <LoginRouteStatus
      description="Authenticator is enabled, so local sign-in stays hidden."
      title="Redirecting to Authentik"
    />
  );
}

function getAuthentikStartPath(forceProviderLogin: boolean): string {
  return forceProviderLogin ? `${authentikStartPath}?prompt=login` : authentikStartPath;
}

function LoginRouteStatus({
  action,
  description,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <main className="relative isolate grid min-h-dvh w-full max-w-full place-items-center overflow-x-hidden bg-background px-4 py-10 text-foreground">
      <LoginBackdrop />
      <div className="w-full max-w-sm rounded-[1.35rem] border border-border bg-card/90 p-6 text-center shadow-(--shadow-panel) backdrop-blur-xl">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-foreground p-2.5 text-background shadow-(--shadow-soft)">
          <span className="text-base font-black tracking-[-0.12em]" aria-hidden="true">
            AW
          </span>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.045em] text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </main>
  );
}

function LoginBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 h-dvh w-full overflow-hidden">
      <img
        alt=""
        aria-hidden="true"
        className="h-full w-full scale-105 object-cover opacity-28 blur-[1.5px] saturate-[0.9]"
        src={loginMediaAssets.backdrop}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,color-mix(in_srgb,var(--primary)_24%,transparent),transparent_28rem),radial-gradient(circle_at_78%_76%,color-mix(in_srgb,var(--catppuccin-color-peach)_16%,transparent),transparent_34rem),linear-gradient(180deg,color-mix(in_srgb,var(--background)_58%,transparent),var(--background)_88%)]" />
      <div className="absolute inset-0 bg-background/54" />
    </div>
  );
}

function LoginPanel() {
  return (
    <section className="relative grid min-h-dvh place-items-center px-3 py-3 sm:px-5 sm:py-4 lg:px-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-[1.65rem] border border-border bg-card/90 p-0 text-card-foreground shadow-(--shadow-panel) backdrop-blur-xl">
        <div className="grid min-h-0 gap-3 p-3 md:h-[min(36rem,calc(100dvh-3.5rem))] md:grid-cols-[minmax(19rem,0.82fr)_minmax(23rem,1.18fr)]">
          <LoginFormPanel />
          <LoginArtworkPanel />
        </div>
      </div>
    </section>
  );
}

function LoginFormPanel() {
  return (
    <div className="relative flex min-h-[min(34rem,calc(100dvh-2rem))] items-start justify-center overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.35rem] border border-border bg-[linear-gradient(135deg,color-mix(in_srgb,var(--card)_94%,transparent),color-mix(in_srgb,var(--background)_94%,transparent),color-mix(in_srgb,var(--secondary)_92%,transparent))] px-5 py-7 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08)] sm:px-8 md:h-full md:min-h-0 md:px-6 md:py-5 lg:px-8">
      <LoginForm />
    </div>
  );
}

function LoginArtworkPanel() {
  return (
    <div className="relative hidden h-full min-h-0 overflow-hidden rounded-[1.35rem] border border-border bg-background md:block">
      <img
        alt=""
        aria-hidden="true"
        className="h-full w-full object-cover opacity-90 saturate-[1.04]"
        src={loginMediaAssets.artwork}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_6%,transparent),color-mix(in_srgb,var(--background)_28%,transparent)),radial-gradient(circle_at_70%_22%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_22rem)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-background/78 to-transparent" />
    </div>
  );
}
