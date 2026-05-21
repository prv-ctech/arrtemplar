import {
  ArrowRightIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
  QueueIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const reviewItems = [
  {
    title: "Harbor of Glass artwork pack",
    status: "Review",
    date: "18.08.24",
    detail: "Poster and banner candidates need a human pick before import.",
    assignees: ["AH", "MK", "VR"],
  },
  {
    title: "Moonlit Saffron folder alias",
    status: "Ready",
    date: "18.08.24",
    detail: "Parser confidence is high enough to attach the release path.",
    assignees: ["LT", "IO"],
  },
  {
    title: "Quiet Comet duplicate request",
    status: "Merge",
    date: "19.08.24",
    detail: "Two watchlist requests point at the same provider record.",
    assignees: ["NS"],
  },
] as const;

const commandRows = [
  ["Metadata import", "Phase 4", "Jikan search, cache, and local anime records"],
  ["Library curation", "Phase 5", "Aliases, episodes, and manual metadata correction"],
  ["Request approvals", "Phase 7", "Approve, deny, and audit user requests"],
] as const;

const scopePanels = [
  ["Scope 1", "Metadata", "8.000", "bg-(--ctp-blue)", "w-[68%]"],
  ["Scope 2", "Requests", "26.504", "bg-primary", "w-[84%]"],
  ["Scope 3", "Library", "7.937", "bg-(--ctp-peach)", "w-[54%]"],
] as const;

const adminTiles = [
  {
    title: "Library",
    description: "Item records, aliases, and manual corrections land here next.",
    icon: <DatabaseIcon aria-hidden="true" className="size-5" weight="duotone" />,
  },
  {
    title: "Search intelligence",
    description: "Release parsing, scoring, and manual review surfaces stay transparent.",
    icon: <MagnifyingGlassIcon aria-hidden="true" className="size-5" weight="duotone" />,
  },
  {
    title: "Downloads",
    description: "Client status, jobs, and import queue controls are staged behind this shell.",
    icon: <DownloadSimpleIcon aria-hidden="true" className="size-5" weight="duotone" />,
  },
] as const;

export function AdminDashboard() {
  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(21rem,0.72fr)_minmax(0,1.28fr)]">
        <QueuePanel />
        <RegistryPanel />
      </section>

      <section className="rounded-4xl border border-border bg-card/76 p-5 shadow-(--shadow-soft) sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <Badge variant="outline">Import scopes</Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              Pipeline pressure by surface
            </h2>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                View guardrails
                <ArrowRightIcon aria-hidden="true" className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Admin shell guardrails</DialogTitle>
                <DialogDescription>
                  Admin features must stay transparent, auditable, and modular. Provider settings,
                  search decisions, and file operations remain explicitly reviewable.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Badge variant="outline">Lawful self-hosted media management only</Badge>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {scopePanels.map(([title, subtitle, value, colorClass, widthClass]) => (
            <article className="py-5 lg:px-5 lg:first:pl-0 lg:last:pr-0" key={title}>
              <div className="flex items-center gap-3">
                <span className={`size-3 rounded-full ${colorClass}`} aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
              </div>
              <div className="mt-8 h-1.5 rounded-full bg-background">
                <div className={`h-full rounded-full ${colorClass} ${widthClass}`} />
              </div>
              <p className="mt-5 font-mono text-2xl font-semibold tracking-tighter text-foreground">
                {value}
                <span className="ml-2 text-xs font-normal tracking-normal text-muted-foreground">
                  units
                </span>
              </p>
            </article>
          ))}
        </div>
      </section>

      <Tabs defaultValue="overview">
        <TabsList aria-label="Admin sections" className="bg-card/80 shadow-(--shadow-soft)">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-5" value="overview">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)]">
            <section className="rounded-4xl border border-border bg-card/78 p-5 shadow-(--shadow-soft) sm:p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Phase runway
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Admin destinations are visible before module APIs land.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandRows.map(([area, phase, purpose]) => (
                    <TableRow key={area}>
                      <TableCell className="font-medium text-foreground">{area}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{phase}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{purpose}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
            <div className="grid gap-5">
              {adminTiles.map((tile) => (
                <FeaturePanel
                  description={tile.description}
                  icon={tile.icon}
                  key={tile.title}
                  title={tile.title}
                />
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent className="mt-5" value="queue">
          <PlaceholderPanel
            description="Durable jobs arrive in Phase 14. This panel reserves the operational space now."
            icon={<QueueIcon aria-hidden="true" className="size-5" weight="duotone" />}
            title="Job queue standby"
          />
        </TabsContent>
        <TabsContent className="mt-5" value="audit">
          <PlaceholderPanel
            description="Auth already writes audit events. Future admin writes surface here with actor and target context."
            icon={<ShieldCheckIcon aria-hidden="true" className="size-5" weight="duotone" />}
            title="Audit stream staged"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QueuePanel() {
  return (
    <section className="rounded-4xl border border-border bg-card/76 p-4 shadow-(--shadow-soft) sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-background/54 px-4 py-3 text-sm text-muted-foreground">
          <MagnifyingGlassIcon aria-hidden="true" className="size-4 text-primary" />
          <span className="truncate">Search admin queue</span>
        </div>
        <Button className="h-12 px-4" type="button">
          Create
        </Button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-background/50 p-1 text-sm">
        <button className="rounded-xl px-3 py-2 text-muted-foreground" type="button">
          Operations
        </button>
        <button className="rounded-xl bg-card px-3 py-2 font-medium text-foreground" type="button">
          Verification
        </button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {["Ongoing 16", "Paused 0", "Overdue 0", "Completed 0"].map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {reviewItems.map((item, index) => (
          <article
            className={
              index === 1
                ? "rounded-3xl border border-primary/35 bg-primary/10 p-4 shadow-(--shadow-soft)"
                : "rounded-3xl border border-border bg-background/50 p-4"
            }
            key={item.title}
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_4.5rem]">
              <div>
                <h2 className="text-base font-semibold leading-6 text-foreground">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
              <time className="grid h-16 place-items-center rounded-2xl bg-card px-2 text-center font-mono text-xs text-muted-foreground">
                {item.date}
              </time>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <Badge variant={index === 1 ? "default" : "outline"}>{item.status}</Badge>
              <div className="flex -space-x-2">
                {item.assignees.map((assignee) => (
                  <span
                    className="grid size-8 place-items-center rounded-xl border border-border bg-card font-mono text-[10px] text-foreground"
                    key={assignee}
                  >
                    {assignee}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RegistryPanel() {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="relative overflow-hidden rounded-4xl border border-border bg-card/76 p-6 shadow-(--shadow-panel) sm:p-8">
        <div className="absolute right-8 top-8 size-48 rounded-full bg-primary/14 blur-3xl" />
        <div className="relative grid min-h-96 place-items-center">
          <div className="relative grid size-64 place-items-center rounded-[4rem] border border-primary/30 bg-background/62 shadow-(--shadow-panel)">
            <div className="absolute inset-x-8 top-12 h-px bg-primary/70" />
            <div className="absolute inset-x-8 bottom-12 h-px bg-(--ctp-peach)/70" />
            <div className="absolute inset-y-8 left-12 w-px bg-(--ctp-blue)/60" />
            <div className="absolute inset-y-8 right-12 w-px bg-primary/60" />
            <span className="text-6xl font-black tracking-tighter text-primary">AW</span>
          </div>
        </div>
        <div className="relative mt-8 max-w-2xl">
          <Badge>Registry preview</Badge>
          <h2 className="mt-3 text-4xl font-semibold leading-none tracking-tighter text-foreground sm:text-5xl">
            Admin command surface for imports and review.
          </h2>
          <p className="mt-4 max-w-[62ch] text-sm leading-6 text-muted-foreground">
            The panel layout follows the reference detail screens: large focal module, right-side
            facts, compact action rail, and a scoped data band below.
          </p>
        </div>
      </div>
      <aside className="rounded-4xl border border-border bg-card/76 p-5 shadow-(--shadow-soft)">
        <div className="overflow-hidden rounded-3xl border border-border bg-background/50">
          <img
            alt="Abstract media registry preview"
            className="aspect-4/3 w-full object-cover opacity-86"
            src="https://picsum.photos/seed/arrtemplar-admin-registry/760/570"
          />
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          {[
            ["Registry ID", "4029"],
            ["Methodology", "VM0038"],
            ["Location", "Library queue"],
          ].map(([term, value]) => (
            <div className="flex items-center justify-between gap-4" key={term}>
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="font-mono text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 rounded-3xl border border-border bg-background/44 p-4">
          <p className="text-sm font-semibold text-foreground">Upcoming checks</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ["3", "week"],
              ["13", "month"],
              ["8", "overdue"],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="font-mono text-xl font-semibold tracking-tighter text-foreground">
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}

function FeaturePanel({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-4xl border border-border bg-card/78 p-5 shadow-(--shadow-soft)">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </section>
  );
}

function PlaceholderPanel({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-4xl border border-dashed border-border bg-card/62 p-5 shadow-(--shadow-soft) sm:p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </section>
  );
}
