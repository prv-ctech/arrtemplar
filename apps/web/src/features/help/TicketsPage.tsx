import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpEmptyStateCard, HelpSectionHeader } from "./HelpSection";
import { HelpTicketCreateDialog } from "./HelpTicketCreateDialog";
import { HelpTicketDetailDialog } from "./HelpTicketDetailDialog";
import { HelpLayout } from "./HelpLayout";
import { HelpTicketList } from "./HelpTicketList";
import { useHelpTicketsPageState } from "./use-help-tickets-page";

function TicketsPage() {
  const {
    canManage,
    createDisabled,
    createMutation,
    createOpen,
    detailQuery,
    detailTicketId,
    draftAttachments,
    draftDescription,
    draftError,
    draftTitle,
    emptyMessage,
    handleAttachmentsChange,
    handleCreateTicket,
    handleStatusChange,
    listQuery,
    selectedTicket,
    setCreateOpen,
    setDetailTicketId,
    setDraftAttachments,
    setDraftDescription,
    setDraftTitle,
    statusMutation,
    tickets,
  } = useHelpTicketsPageState();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <HelpSectionHeader description="Requests and status." title="Tickets" />
        <Button onClick={() => setCreateOpen(true)} size="sm" type="button">
          New ticket
        </Button>
      </div>
      {listQuery.isLoading ? <TicketsLoadingState /> : null}
      {listQuery.isError ? (
        <HelpEmptyStateCard title="Tickets">
          {listQuery.error instanceof Error ? listQuery.error.message : "Ticket list failed."}
        </HelpEmptyStateCard>
      ) : null}
      {!listQuery.isLoading && !listQuery.isError && !listQuery.data?.items.length ? (
        <HelpEmptyStateCard title="Tickets">{emptyMessage} Create first ticket.</HelpEmptyStateCard>
      ) : null}
      {!listQuery.isLoading && !listQuery.isError && listQuery.data?.items.length ? (
        <HelpTicketList canManage={canManage} onOpen={setDetailTicketId} tickets={tickets} />
      ) : null}

      <HelpTicketCreateDialog
        attachments={draftAttachments}
        createDisabled={createDisabled}
        draftDescription={draftDescription}
        draftError={draftError}
        draftTitle={draftTitle}
        isSubmitting={createMutation.isPending}
        onAttachmentsChange={handleAttachmentsChange}
        onDescriptionChange={setDraftDescription}
        onOpenChange={setCreateOpen}
        onRemoveAttachment={(index) =>
          setDraftAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))
        }
        onSubmit={handleCreateTicket}
        onTitleChange={setDraftTitle}
        open={createOpen}
      />

      <HelpTicketDetailDialog
        canManage={canManage}
        errorMessage={detailQuery.error instanceof Error ? detailQuery.error.message : null}
        onOpenChange={(open) => (!open ? setDetailTicketId(null) : undefined)}
        onStatusChange={handleStatusChange}
        open={Boolean(detailTicketId)}
        selectedTicket={detailQuery.isLoading ? null : selectedTicket ?? null}
        statusPending={statusMutation.isPending}
      />
    </section>
  );
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
    <div className="grid gap-3">
      <Skeleton className="h-18 w-full" />
      <Skeleton className="h-18 w-full" />
      <Skeleton className="h-18 w-full" />
    </div>
  );
}