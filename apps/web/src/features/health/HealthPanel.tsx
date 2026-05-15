import { ActivityIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getHealth } from "@/lib/api";

export function HealthPanel() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30_000,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
            <ActivityIcon aria-hidden="true" className="h-5 w-5" weight="duotone" />
          </div>
          <div>
            <CardTitle>Backend health</CardTitle>
            <CardDescription>Live status from the Elysia API.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {healthQuery.isPending ? <HealthLoading /> : null}
        {healthQuery.isError ? (
          <HealthError message={healthQuery.error.message} onRetry={() => healthQuery.refetch()} />
        ) : null}
        {healthQuery.data ? <HealthReady health={healthQuery.data} /> : null}
      </CardContent>
    </Card>
  );
}

function HealthLoading() {
  return (
    <div aria-busy="true" className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
      Checking API status…
    </div>
  );
}

function HealthError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <WarningCircleIcon
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 text-destructive"
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
    <div className="grid gap-4 rounded-lg border border-primary/30 bg-primary/10 p-4 sm:grid-cols-2">
      <div className="flex items-center gap-3 sm:col-span-2">
        <CheckCircleIcon aria-hidden="true" className="h-5 w-5 text-primary" weight="duotone" />
        <p className="font-medium">
          {health.name} API is {health.status}
        </p>
      </div>
      <StatusField label="Version" value={health.version} />
      <StatusField label="Updated" value={new Date(health.timestamp).toLocaleString()} />
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
