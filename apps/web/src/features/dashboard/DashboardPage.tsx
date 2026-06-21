import type { PublicUser } from "@arrtemplar/shared";
import {
  ArrowRightIcon,
  DatabaseIcon,
  MagnifyingGlassIcon,
  PulseIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { HealthPanel } from "@/features/health/HealthPanel";

const summaryRows = [
  { label: "Collecting", value: "14", dotClass: "bg-primary" },
  { label: "Ready to match", value: "7", dotClass: "bg-ctp-blue" },
  { label: "Needs metadata", value: "12", dotClass: "bg-ctp-peach" },
  { label: "Manual review", value: "8", dotClass: "bg-ctp-yellow" },
  { label: "Archived", value: "9", dotClass: "bg-ctp-rosewater" },
] as const;

const eventRows = [
  {
    title: "Alias match found for Moonlit Saffron",
    detail: "Parser linked season folder and release title",
    day: "18",
    month: "Aug",
    tone: "border-l-primary",
  },
  {
    title: "Harbor of Glass needs provider artwork",
    detail: "Import panel will request poster and banner assets",
    day: "22",
    month: "Aug",
    tone: "border-l-ctp-peach",
  },
  {
    title: "Quiet Comet moved to admin review",
    detail: "Duplicate request merged into a single queue item",
    day: "24",
    month: "Aug",
    tone: "border-l-ctp-blue",
  },
] as const;

const demandBars = [
  ["Mon", "h-16"],
  ["Tue", "h-28"],
  ["Wed", "h-36"],
  ["Thu", "h-24"],
  ["Fri", "h-32"],
  ["Sat", "h-20"],
] as const;

const mediaCards = [
  ["Kitsune Relay", "Dual-audio match", "media-kitsune-relay", "1080p"],
  ["Harbor of Glass", "Artwork pending", "media-harbor-glass", "OVA"],
  ["Moonlit Saffron", "Alias confidence 84.6%", "media-moonlit-saffron", "S02"],
  ["Aster Train", "Watchlist request", "media-aster-train", "TV"],
] as const;

const operations = [
  ["Protected routing", "Server session decides the landing page."],
  ["Admin review", "Role-gated tools remain visible without leaking actions."],
] as const;

export function DashboardPage({ user }: { user: PublicUser }) {
  return (
    <div className="space-y-5">
      <DashboardOverview username={user.username} />
      <QueuePanel />
      <OperationsSection />
    </div>
  );
}

function DashboardOverview({ username }: { username: string }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)_minmax(18rem,0.72fr)]">
      <SummaryPanel username={username} />
      <EventsPanel />
      <DemandPanel />
    </section>
  );
}

function QueuePanel() {
  return (
    <section className="rounded-4xl border border-border bg-card/76 p-4 shadow-(--shadow-soft) sm:p-5">
      <QueueToolbar />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {mediaCards.map(([title, status, seed, label]) => (
          <MediaQueueCard key={title} label={label} seed={seed} status={status} title={title} />
        ))}
      </div>
    </section>
  );
}

function QueueToolbar() {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
      <QueueSearch />
      <QueueFilters />
    </div>
  );
}

function QueueSearch() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-background/54 px-4 py-3 text-sm text-muted-foreground">
      <MagnifyingGlassIcon aria-hidden="true" className="size-4 text-primary" />
      <span className="truncate">Search queued titles, aliases, or source folders</span>
    </div>
  );
}

function QueueFilters() {
  return (
    <nav aria-label="Queue filters" className="flex flex-wrap gap-2 text-sm">
      {["All requests", "Ready", "Metadata", "Review", "Archived"].map((filter, index) => (
        <QueueFilterButton isActive={index === 0} key={filter} label={filter} />
      ))}
    </nav>
  );
}

function QueueFilterButton({ isActive, label }: { isActive: boolean; label: string }) {
  return (
    <button
      className={
        isActive
          ? "rounded-xl bg-primary px-3 py-2 font-medium text-primary-foreground shadow-(--shadow-button)"
          : "rounded-xl border border-border px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      }
      type="button"
    >
      {label}
    </button>
  );
}

function MediaQueueCard({
  label,
  seed,
  status,
  title,
}: {
  label: string;
  seed: string;
  status: string;
  title: string;
}) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-border bg-background/54">
      <div className="relative aspect-5/3 overflow-hidden bg-muted">
        <img
          alt={`${title} media preview`}
          className="h-full w-full object-cover opacity-86 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
          src={`https://picsum.photos/seed/${seed}/900/540`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_34%,color-mix(in_srgb,var(--catppuccin-color-crust)_82%,transparent))]" />
        <span className="absolute right-3 top-3 rounded-lg border border-border bg-background/72 px-2 py-1 font-mono text-xs text-foreground backdrop-blur-md">
          {label}
        </span>
      </div>
      <div className="p-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{status}</p>
      </div>
    </article>
  );
}

function OperationsSection() {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <HealthPanel />
      <OperationsPanel />
    </section>
  );
}

function OperationsPanel() {
  return (
    <div className="rounded-4xl border border-border bg-card/76 p-5 shadow-(--shadow-soft) sm:p-6">
      <OperationsHeader />
      <div className="mt-5 divide-y divide-border rounded-3xl border border-border bg-background/48">
        {operations.map(([title, detail]) => (
          <OperationRow detail={detail} key={title} title={title} />
        ))}
      </div>
    </div>
  );
}

function OperationsHeader() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Badge variant="outline">Operations detail</Badge>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-foreground">
          What the shell already protects
        </h2>
        <p className="mt-2 max-w-[58ch] text-sm leading-6 text-muted-foreground">
          The layout borrows the reference rhythm: left rail, compact header, ordered event cards,
          and image-led media rows. The palette follows the selected theme pack.
        </p>
      </div>
      <ArrowRightIcon aria-hidden="true" className="mt-1 size-5 text-primary" />
    </div>
  );
}

function OperationRow({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="grid gap-2 p-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function SummaryPanel({ username }: { username: string }) {
  return (
    <section className="rounded-4xl border border-border bg-card/78 p-5 shadow-(--shadow-soft) sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge>Library summary</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            Welcome back, {username}
          </h2>
        </div>
        <ShieldCheckIcon aria-hidden="true" className="size-6 text-primary" weight="duotone" />
      </div>
      <SummaryContent />
    </section>
  );
}

function SummaryContent() {
  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
      <SummaryDonut />
      <SummaryRows />
    </div>
  );
}

function SummaryDonut() {
  return (
    <div className="relative mx-auto grid size-40 place-items-center rounded-full bg-[conic-gradient(from_210deg,var(--catppuccin-color-blue)_0_30%,var(--catppuccin-color-sky)_30%_48%,var(--catppuccin-color-peach)_48%_64%,var(--catppuccin-color-yellow)_64%_79%,var(--catppuccin-color-rosewater)_79%_100%)]">
      <div className="grid size-28 place-items-center rounded-full border border-border bg-card text-center shadow-(--shadow-soft)">
        <span>
          <span className="block font-mono text-4xl font-semibold tracking-tighter text-foreground">
            50
          </span>
          <span className="block text-xs text-muted-foreground">requests</span>
        </span>
      </div>
    </div>
  );
}

function SummaryRows() {
  return (
    <div className="space-y-3">
      {summaryRows.map((row) => (
        <SummaryRow key={row.label} {...row} />
      ))}
    </div>
  );
}

function SummaryRow({
  dotClass,
  label,
  value,
}: {
  dotClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[0.75rem_minmax(0,1fr)_2.5rem] items-center gap-3">
      <span aria-hidden="true" className={`size-2 rounded-full ${dotClass}`} />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

function EventsPanel() {
  return (
    <section className="rounded-4xl border border-border bg-card/78 p-5 shadow-(--shadow-soft) sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="outline">Release events</Badge>
          <div className="mt-4 grid grid-cols-3 gap-5">
            {[
              ["3", "This week"],
              ["13", "This month"],
              ["8", "Overdue"],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="font-mono text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <PulseIcon aria-hidden="true" className="size-6 text-primary" weight="duotone" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-background/50 p-1 text-sm">
        <button className="rounded-xl bg-card px-3 py-2 font-medium text-foreground" type="button">
          Parser events
        </button>
        <button className="rounded-xl px-3 py-2 text-muted-foreground" type="button">
          Review events
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {eventRows.map((event) => (
          <article
            className={`grid grid-cols-[minmax(0,1fr)_3.75rem] gap-3 rounded-2xl border border-border border-l-2 bg-background/48 p-3 ${event.tone}`}
            key={event.title}
          >
            <div>
              <h3 className="text-sm font-semibold leading-5 text-foreground">{event.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.detail}</p>
            </div>
            <time className="grid place-items-center rounded-xl bg-card px-2 py-1 text-center font-mono text-xs text-muted-foreground">
              <span>{event.month}</span>
              <span className="text-base text-foreground">{event.day}</span>
            </time>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemandPanel() {
  return (
    <section className="rounded-4xl border border-border bg-card/78 p-5 shadow-(--shadow-soft) sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="outline">Demand signal</Badge>
          <p className="mt-4 font-mono text-3xl font-semibold tracking-tighter text-foreground">
            42.7k
          </p>
          <p className="mt-1 text-xs text-muted-foreground">parser checks staged</p>
        </div>
        <DatabaseIcon aria-hidden="true" className="size-6 text-primary" weight="duotone" />
      </div>
      <div className="mt-8 flex h-44 items-end gap-3 border-b border-border px-1">
        {demandBars.map(([label, height]) => (
          <div className="flex flex-1 flex-col items-center gap-2" key={label}>
            <div
              className={`w-full rounded-t-xl bg-[linear-gradient(180deg,var(--catppuccin-color-peach),color-mix(in_srgb,var(--catppuccin-color-blue)_64%,var(--catppuccin-color-base)))] ${height}`}
            />
            <span className="font-mono text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Weekly request pressure stays visible without using the reference dashboard palette.
      </p>
    </section>
  );
}
