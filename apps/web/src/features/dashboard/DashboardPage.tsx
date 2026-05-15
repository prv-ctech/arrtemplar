import type { PublicUser } from "@arrweeb-anime/shared";
import { DatabaseIcon, PulseIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthPanel } from "@/features/health/HealthPanel";

const milestones = [
  {
    label: "Phase 3 shell",
    value: "Active",
    description: "Auth-aware layouts, protected routes, and role-based navigation.",
    icon: <ShieldCheckIcon aria-hidden="true" className="size-5" weight="duotone" />,
  },
  {
    label: "Phase 4 metadata",
    value: "Next",
    description: "Jikan search/import will enter through the admin command surface.",
    icon: <DatabaseIcon aria-hidden="true" className="size-5" weight="duotone" />,
  },
];

export function DashboardPage({ user }: { user: PublicUser }) {
  return (
    <div className="space-y-8">
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div className="space-y-4">
          <Badge>Signed in</Badge>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Welcome back, {user.username}.
            </h1>
            <p className="text-base leading-7 text-muted-foreground sm:text-lg">
              The Phase 3 shell is now the control room for anime-native requesting, metadata,
              search intelligence, and playback work.
            </p>
          </div>
        </div>
        <Card className="border-primary/20 bg-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PulseIcon aria-hidden="true" className="size-5 text-primary" weight="duotone" />
              Session role
            </CardTitle>
            <CardDescription>Routes now react to server auth state.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
          </CardContent>
        </Card>
      </header>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <HealthPanel />
        <div className="grid gap-5">
          {milestones.map((milestone) => (
            <Card className="border-white/10 bg-card/75" key={milestone.label}>
              <CardHeader className="flex-row items-start gap-4 space-y-0">
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary">
                  {milestone.icon}
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base">{milestone.label}</CardTitle>
                  <CardDescription>{milestone.description}</CardDescription>
                </div>
                <Badge className="ml-auto" variant="outline">
                  {milestone.value}
                </Badge>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
