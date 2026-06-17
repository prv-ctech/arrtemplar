import { ActivityIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getHealth } from "@/lib/api";

const healthTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function HealthPanel() {
  const {
    data: health,
    error,
    isError,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30_000,
  });

  return (
    <Card className="h-full overflow-hidden bg-card/78">
      <HealthPanelHeader />
      <HealthPanelContent
        errorMessage={error?.message}
        health={health}
        isError={isError}
        isPending={isPending}
        onRetry={() => refetch()}
      />
    </Card>
  );
}

function HealthPanelHeader() {
  return (
    <CardHeader>
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-2 text-primary">
          <ActivityIcon aria-hidden="true" className="size-5" weight="duotone" />
        </div>
        <div>
          <CardTitle>Backend health</CardTitle>
          <CardDescription>Live status from the Elysia API.</CardDescription>
        </div>
      </div>
    </CardHeader>
  );
}

function HealthPanelContent({
  errorMessage,
  health,
  isError,
  isPending,
  onRetry,
}: {
  errorMessage?: string | undefined;
  health?: { name: string; version: string; status: string; timestamp: string } | undefined;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
}) {
  return (
    <CardContent>
      {isPending ? <HealthLoading /> : null}
      {isError && errorMessage ? <HealthError message={errorMessage} onRetry={onRetry} /> : null}
      {health ? <HealthReady health={health} /> : null}
    </CardContent>
  );
}

function HealthLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="space-y-3 rounded-3xl border border-border bg-background/48 p-4"
    >
      <span className="sr-only">Checking API status</span>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function HealthError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-4 rounded-3xl border border-destructive/35 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <WarningCircleIcon
          aria-hidden="true"
          className="mt-0.5 size-5 text-destructive"
          weight="duotone"
        />
        <div>
          <p className="font-medium">API is not reachable yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <Button onClick={onRetry} size="sm" variant="secondary">
        Retry health check
      </Button>
    </div>
  );
}

function HealthReady({
  health,
}: {
  health: { name: string; version: string; status: string; timestamp: string };
}) {
  return (
    <div className="grid gap-4 rounded-3xl border border-primary/25 bg-primary/10 p-4 sm:grid-cols-2">
      <div className="flex items-center gap-3 sm:col-span-2">
        <CheckCircleIcon aria-hidden="true" className="size-5 text-primary" weight="duotone" />
        <p className="font-medium">
          {health.name} API is {health.status}
        </p>
      </div>
      <dl className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
        <StatusField label="Version" value={health.version} />
        <StatusField
          label="Updated"
          value={healthTimestampFormatter.format(Date.parse(health.timestamp))}
        />
      </dl>
    </div>
  );
}

function StatusField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
