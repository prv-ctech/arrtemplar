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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const commandRows = [
  ["Metadata import", "Phase 4", "Jikan search, cache, and local anime records"],
  ["Library curation", "Phase 5", "Aliases, episodes, and manual metadata correction"],
  ["Request approvals", "Phase 7", "Approve, deny, and audit user requests"],
] as const;

const adminTiles = [
  {
    title: "Library",
    description: "Anime records, aliases, episodes, and manual corrections land here next.",
    icon: <DatabaseIcon aria-hidden="true" className="size-5" weight="duotone" />,
  },
  {
    title: "Search intelligence",
    description: "Release parsing, scoring, and manual review surfaces will be transparent here.",
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
    <div className="space-y-8">
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-4">
          <Badge>Admin navigation online</Badge>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Operator surface for the anime pipeline.
            </h1>
            <p className="text-base leading-7 text-muted-foreground sm:text-lg">
              The shell is ready for the metadata, request, search, download, and import modules
              that will arrive in the next phases.
            </p>
          </div>
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
                search decisions, and file operations will remain explicitly reviewable.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Badge variant="outline">Lawful self-hosted media management only</Badge>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>
      <Tabs defaultValue="overview">
        <TabsList aria-label="Admin sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-5" value="overview">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-white/10 bg-card/75">
              <CardHeader>
                <CardTitle>Phase runway</CardTitle>
                <CardDescription>
                  Admin destinations are visible before module APIs land.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
            <div className="grid gap-5">
              {adminTiles.map((tile) => (
                <Card className="border-white/10 bg-card/75" key={tile.title}>
                  <CardHeader className="flex-row items-start gap-4 space-y-0">
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary">
                      {tile.icon}
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-base">{tile.title}</CardTitle>
                      <CardDescription>{tile.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
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
            description="Auth already writes audit events. Future admin writes will surface here with actor and target context."
            icon={<ShieldCheckIcon aria-hidden="true" className="size-5" weight="duotone" />}
            title="Audit stream staged"
          />
        </TabsContent>
      </Tabs>
    </div>
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
    <Card className="border-dashed border-white/15 bg-card/55">
      <CardHeader className="flex-row items-start gap-4 space-y-0">
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2 text-primary">
          {icon}
        </div>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-2 max-w-2xl leading-6">{description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}
