import type { HelpTicketDetail, HelpTicketStatus, HelpTicketSummary } from "@arrtemplar/shared";
import {
  CheckCircleIcon,
  DotsThreeVerticalIcon,
  HourglassMediumIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HelpTicketAttachmentGrid } from "./HelpTicketAttachmentGrid";
import { HelpTicketStatusBadge } from "./help-ticket-status-badge";

export function HelpTicketList({
  canManage,
  detailErrorMessage,
  expandedTicketId,
  onDelete,
  onStatusChange,
  onToggle,
  selectedTicket,
  statusPending,
  ticketActionPending,
  ticketDetailLoading,
  tickets,
}: {
  canManage: boolean;
  detailErrorMessage: string | null;
  expandedTicketId: string | null;
  onDelete: (ticketId: string) => void;
  onStatusChange: (ticketId: string, status: HelpTicketStatus) => void;
  onToggle: (ticketId: string | null) => void;
  selectedTicket: HelpTicketDetail | null;
  statusPending: boolean;
  ticketActionPending: boolean;
  ticketDetailLoading: boolean;
  tickets: HelpTicketSummary[];
}) {
  const desktopColumnCount = canManage ? 6 : 4;

  return (
    <>
      <div className="hidden md:block">
        <Table containerClassName="rounded-lg border-border/80 bg-card/50 pb-0">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 px-3 text-xs">Ticket</TableHead>
              <TableHead className="h-8 px-3 text-xs">Status</TableHead>
              {canManage ? <TableHead className="h-8 px-3 text-xs">Reporter</TableHead> : null}
              <TableHead className="h-8 px-3 text-xs">Files</TableHead>
              <TableHead className="h-8 px-3 text-xs">Updated</TableHead>
              {canManage ? (
                <TableHead className="h-8 px-3 text-right text-xs">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => {
              const isExpanded = expandedTicketId === ticket.id;

              return (
                <Fragment key={ticket.id}>
                  <TableRow
                    className="cursor-pointer"
                    data-state={isExpanded ? "selected" : undefined}
                    onClick={() => onToggle(isExpanded ? null : ticket.id)}
                  >
                    <TableCell className="max-w-136 px-3 py-2">
                      <TicketTitleButton
                        expanded={isExpanded}
                        onToggle={() => onToggle(isExpanded ? null : ticket.id)}
                        ticket={ticket}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <HelpTicketStatusBadge status={ticket.status} />
                    </TableCell>
                    {canManage ? (
                      <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                        {ticket.createdBy.username}
                      </TableCell>
                    ) : null}
                    <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                      {ticket.attachmentCount}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                      {formatTicketDate(ticket.updatedAt)}
                    </TableCell>
                    {canManage ? (
                      <TableCell
                        className="px-3 py-2 text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <TicketActionMenu
                          disabled={ticketActionPending}
                          onDelete={() => onDelete(ticket.id)}
                          onStatusChange={(status) => onStatusChange(ticket.id, status)}
                          statusPending={statusPending}
                          ticket={ticket}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                  {isExpanded ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        className="bg-background/35 px-3 py-3"
                        colSpan={desktopColumnCount}
                      >
                        <TicketInlineDetail
                          canManage={canManage}
                          errorMessage={detailErrorMessage}
                          isLoading={ticketDetailLoading}
                          selectedTicket={selectedTicket?.id === ticket.id ? selectedTicket : null}
                          ticket={ticket}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-2 md:hidden">
        {tickets.map((ticket) => {
          const isExpanded = expandedTicketId === ticket.id;

          return (
            <div className="rounded-lg border border-border/80 bg-card/50 p-3" key={ticket.id}>
              <div className="flex items-start justify-between gap-3">
                <TicketTitleButton
                  expanded={isExpanded}
                  onToggle={() => onToggle(isExpanded ? null : ticket.id)}
                  ticket={ticket}
                />
                <div className="flex shrink-0 items-center gap-2">
                  <HelpTicketStatusBadge status={ticket.status} />
                  {canManage ? (
                    <TicketActionMenu
                      disabled={ticketActionPending}
                      onDelete={() => onDelete(ticket.id)}
                      onStatusChange={(status) => onStatusChange(ticket.id, status)}
                      statusPending={statusPending}
                      ticket={ticket}
                    />
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{canManage ? ticket.createdBy.username : ticket.id}</span>
                <span>{ticket.attachmentCount} files</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTicketDate(ticket.updatedAt)}
              </p>
              {isExpanded ? (
                <div className="mt-3 border-border border-t pt-3">
                  <TicketInlineDetail
                    canManage={canManage}
                    errorMessage={detailErrorMessage}
                    isLoading={ticketDetailLoading}
                    selectedTicket={selectedTicket?.id === ticket.id ? selectedTicket : null}
                    ticket={ticket}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TicketTitleButton({
  expanded,
  onToggle,
  ticket,
}: {
  expanded: boolean;
  onToggle: () => void;
  ticket: HelpTicketSummary;
}) {
  return (
    <button
      aria-expanded={expanded}
      className="group flex min-w-0 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      type="button"
    >
      <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
        {ticket.title}
      </span>
      <span className="mt-0.5 text-[11px] text-muted-foreground">{ticket.id}</span>
    </button>
  );
}

function TicketActionMenu({
  disabled,
  onDelete,
  onStatusChange,
  statusPending,
  ticket,
}: {
  disabled: boolean;
  onDelete: () => void;
  onStatusChange: (status: HelpTicketStatus) => void;
  statusPending: boolean;
  ticket: HelpTicketSummary;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Ticket actions for ${ticket.title}`}
          className="size-7 rounded-md p-0"
          disabled={disabled}
          size="icon"
          type="button"
          variant="ghost"
        >
          <DotsThreeVerticalIcon aria-hidden="true" className="size-4" weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl">
        <DropdownMenuItem
          disabled={statusPending || ticket.status === "in_progress"}
          onSelect={() => onStatusChange("in_progress")}
        >
          <HourglassMediumIcon aria-hidden="true" className="size-4" />
          Set in progress
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={statusPending || ticket.status === "completed"}
          onSelect={() => onStatusChange("completed")}
        >
          <CheckCircleIcon aria-hidden="true" className="size-4" />
          Set complete
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} variant="destructive">
          <TrashIcon aria-hidden="true" className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TicketInlineDetail({
  canManage,
  errorMessage,
  isLoading,
  selectedTicket,
  ticket,
}: {
  canManage: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  selectedTicket: HelpTicketDetail | null;
  ticket: HelpTicketSummary;
}) {
  if (errorMessage) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/60 p-3 text-sm text-muted-foreground">
        {errorMessage}
      </div>
    );
  }

  if (isLoading || !selectedTicket) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <HelpTicketStatusBadge status={selectedTicket.status} />
        {canManage ? <span>{selectedTicket.createdBy.username}</span> : null}
        <span>{formatTicketDate(selectedTicket.updatedAt)}</span>
        <span>{ticket.attachmentCount} files</span>
      </div>
      <div className="rounded-lg border border-border/80 bg-background/60 p-3 text-sm leading-6 text-foreground">
        {selectedTicket.description}
      </div>
      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">Files</p>
        <HelpTicketAttachmentGrid
          attachments={selectedTicket.attachments}
          ticketId={selectedTicket.id}
        />
      </div>
    </div>
  );
}

function formatTicketDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
