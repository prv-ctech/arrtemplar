import { HELP_TICKET_STATUS_VALUES, type HelpTicketSortOrder } from "@arrtemplar/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpLayout } from "./HelpLayout";
import { HelpEmptyStateCard } from "./HelpSection";
import { HelpTicketCreateDialog } from "./HelpTicketCreateDialog";
import { HelpTicketList } from "./HelpTicketList";
import { type HelpTicketStatusFilter, useHelpTicketsPageState } from "./use-help-tickets-page";

const HELP_TICKET_FILTERS = [
  { label: "All", value: "all" },
  ...HELP_TICKET_STATUS_VALUES.map((status) => ({
    label: readHelpTicketFilterLabel(status),
    value: status,
  })),
] satisfies { label: string; value: HelpTicketStatusFilter }[];

function readHelpTicketFilterLabel(status: Exclude<HelpTicketStatusFilter, "all">): string {
  switch (status) {
    case "completed":
      return "Done";
    case "in_progress":
      return "Progress";
    case "new":
      return "New";
  }
}

function TicketsPage() {
  const state = useHelpTicketsPageState();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <TicketToolbar
          onCreateTicket={() => state.setCreateOpen(true)}
          onSearchQueryChange={state.setSearchQuery}
          onSortOrderChange={state.setSortOrder}
          searchQuery={state.searchQuery}
          sortOrder={state.sortOrder}
          totalTicketCount={state.totalTicketCount}
        />
      </div>

      <Tabs
        className="gap-3"
        onValueChange={(value) => {
          if (isHelpTicketStatusFilter(value)) {
            state.setActiveStatus(value);
          }
        }}
        value={state.activeStatus}
      >
        <TabsList
          aria-label="Ticket status"
          className="h-8 w-full justify-start border-border border-b p-0 pb-0.75"
          variant="line"
        >
          {HELP_TICKET_FILTERS.map((filter) => (
            <TabsTrigger
              className="h-8 flex-none rounded-none px-2.5 text-xs"
              key={filter.value}
              value={filter.value}
            >
              {filter.label}
              <span className="rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">
                {state.ticketStatusCounts[filter.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {HELP_TICKET_FILTERS.map((filter) => (
          <TabsContent className="mt-0" key={filter.value} value={filter.value}>
            <TicketResults
              canManage={state.canManage}
              emptyMessage={state.emptyMessage}
              hasActiveFilters={state.hasActiveFilters}
              listQuery={state.listQuery}
              onClearFilters={() => {
                state.setActiveStatus("all");
                state.setSearchQuery("");
              }}
              detailErrorMessage={
                state.detailQuery.error instanceof Error ? state.detailQuery.error.message : null
              }
              expandedTicketId={state.detailTicketId}
              onDeleteTicket={state.handleDeleteTicket}
              onOpenTicket={state.setDetailTicketId}
              onStatusChange={state.handleStatusChange}
              selectedTicket={state.selectedTicket ?? null}
              statusPending={state.statusMutation.isPending}
              ticketActionPending={state.statusMutation.isPending || state.deleteMutation.isPending}
              ticketDetailLoading={state.detailQuery.isLoading}
              tickets={state.activeStatus === filter.value ? state.tickets : []}
            />
          </TabsContent>
        ))}
      </Tabs>

      <HelpTicketCreateDialog
        attachments={state.draftAttachments}
        createDisabled={state.createDisabled}
        draftDescription={state.draftDescription}
        draftError={state.draftError}
        draftTitle={state.draftTitle}
        isSubmitting={state.createMutation.isPending}
        onAttachmentsChange={state.handleAttachmentsChange}
        onDescriptionChange={state.setDraftDescription}
        onOpenChange={state.setCreateOpen}
        onRemoveAttachment={(index) =>
          state.setDraftAttachments((current) =>
            current.filter((_, currentIndex) => currentIndex !== index),
          )
        }
        onSubmit={() => state.handleCreateTicket(state.setDetailTicketId)}
        onTitleChange={state.setDraftTitle}
        open={state.createOpen}
      />
    </section>
  );
}

function TicketToolbar({
  onCreateTicket,
  onSearchQueryChange,
  onSortOrderChange,
  searchQuery,
  sortOrder,
  totalTicketCount,
}: {
  onCreateTicket: () => void;
  onSearchQueryChange: (value: string) => void;
  onSortOrderChange: (value: HelpTicketSortOrder) => void;
  searchQuery: string;
  sortOrder: HelpTicketSortOrder;
  totalTicketCount: number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-card/45 p-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor="ticket-search">
          Search tickets
        </label>
        <Input
          className="h-8 rounded-md border-border bg-background/70 px-2.5 text-sm"
          id="ticket-search"
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search tickets"
          type="search"
          value={searchQuery}
        />
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="text-xs text-muted-foreground">{totalTicketCount} total</span>
        <Select
          onValueChange={(value) => onSortOrderChange(value === "asc" ? "asc" : "desc")}
          value={sortOrder}
        >
          <SelectTrigger className="h-8 w-32 rounded-md bg-background/70 px-2.5" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest</SelectItem>
            <SelectItem value="asc">Oldest</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="h-8 rounded-md px-2.5 text-sm"
          onClick={onCreateTicket}
          size="sm"
          type="button"
        >
          New ticket
        </Button>
      </div>
    </div>
  );
}

function TicketResults({
  canManage,
  emptyMessage,
  hasActiveFilters,
  listQuery,
  detailErrorMessage,
  expandedTicketId,
  onDeleteTicket,
  onClearFilters,
  onOpenTicket,
  onStatusChange,
  selectedTicket,
  statusPending,
  ticketActionPending,
  ticketDetailLoading,
  tickets,
}: {
  canManage: boolean;
  detailErrorMessage: string | null;
  emptyMessage: string;
  expandedTicketId: string | null;
  hasActiveFilters: boolean;
  listQuery: ReturnType<typeof useHelpTicketsPageState>["listQuery"];
  onClearFilters: () => void;
  onDeleteTicket: (ticketId: string) => void;
  onOpenTicket: (ticketId: string | null) => void;
  onStatusChange: Parameters<typeof HelpTicketList>[0]["onStatusChange"];
  selectedTicket: ReturnType<typeof useHelpTicketsPageState>["selectedTicket"] | null;
  statusPending: boolean;
  ticketActionPending: boolean;
  ticketDetailLoading: boolean;
  tickets: ReturnType<typeof useHelpTicketsPageState>["tickets"];
}) {
  const stateContent = readTicketResultsState({
    emptyMessage,
    hasActiveFilters,
    listQuery,
    onClearFilters,
    ticketsLength: tickets.length,
  });

  if (stateContent) {
    return stateContent;
  }

  return (
    <HelpTicketList
      canManage={canManage}
      detailErrorMessage={detailErrorMessage}
      expandedTicketId={expandedTicketId}
      onDelete={onDeleteTicket}
      onToggle={onOpenTicket}
      onStatusChange={onStatusChange}
      selectedTicket={selectedTicket ?? null}
      statusPending={statusPending}
      ticketActionPending={ticketActionPending}
      ticketDetailLoading={ticketDetailLoading}
      tickets={tickets}
    />
  );
}

function readTicketResultsState({
  emptyMessage,
  hasActiveFilters,
  listQuery,
  onClearFilters,
  ticketsLength,
}: {
  emptyMessage: string;
  hasActiveFilters: boolean;
  listQuery: ReturnType<typeof useHelpTicketsPageState>["listQuery"];
  onClearFilters: () => void;
  ticketsLength: number;
}) {
  if (listQuery.isLoading) {
    return <TicketsLoadingState />;
  }

  if (listQuery.isError) {
    return (
      <HelpEmptyStateCard title="Tickets">
        {listQuery.error instanceof Error ? listQuery.error.message : "Ticket list failed."}
      </HelpEmptyStateCard>
    );
  }

  if (ticketsLength === 0) {
    return (
      <TicketEmptyState
        emptyMessage={emptyMessage}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      />
    );
  }

  return null;
}

function TicketEmptyState({
  emptyMessage,
  hasActiveFilters,
  onClearFilters,
}: {
  emptyMessage: string;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <HelpEmptyStateCard title="Tickets">
      <span>
        {hasActiveFilters
          ? `${emptyMessage} Try another filter.`
          : `${emptyMessage} Create first ticket.`}
      </span>
      {hasActiveFilters ? (
        <Button
          className="mt-3 h-8 rounded-md px-2.5 text-sm"
          onClick={onClearFilters}
          size="sm"
          type="button"
          variant="secondary"
        >
          Clear filters
        </Button>
      ) : null}
    </HelpEmptyStateCard>
  );
}

function isHelpTicketStatusFilter(value: string): value is HelpTicketStatusFilter {
  return value === "all" || HELP_TICKET_STATUS_VALUES.some((status) => status === value);
}

export function HelpTicketsRoute() {
  return (
    <HelpLayout activePage="tickets">
      <TicketsPage />
    </HelpLayout>
  );
}

function TicketsLoadingState() {
  return (
    <div className="grid gap-2">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}
