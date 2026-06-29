import type { HelpTicketSortOrder, HelpTicketStatus, HelpTicketSummary } from "@arrtemplar/shared";
import { useMemo, useState } from "react";
import { canManageHelpTickets } from "@/features/auth/auth-state";
import { notify } from "@/features/notifications/notification-gateway";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import {
  useCreateHelpTicketMutation,
  useDeleteHelpTicketMutation,
  useHelpTicketDetailQuery,
  useHelpTicketListQuery,
  useUpdateHelpTicketStatusMutation,
  validateHelpTicketDraftFiles,
} from "./help-ticket-data";

export type HelpTicketStatusFilter = "all" | HelpTicketStatus;

type HelpTicketStatusCounts = Record<HelpTicketStatusFilter, number>;
type NotificationPreferences = ReturnType<
  typeof useAuthenticatedRouteUser
>["notificationPreferences"];

export function useHelpTicketsPageState() {
  const user = useAuthenticatedRouteUser();
  const canManage = canManageHelpTickets(user);

  return {
    canManage,
    ...useHelpTicketListState(canManage),
    ...useHelpTicketDetailState(user.notificationPreferences),
    ...useHelpTicketDraftState(user.notificationPreferences),
  };
}

function useHelpTicketListState(canManage: boolean) {
  const [activeStatus, setActiveStatus] = useState<HelpTicketStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<HelpTicketSortOrder>("desc");
  const listQuery = useHelpTicketListQuery({
    scope: readTicketListScope(canManage),
    sortOrder,
  });
  const sourceTickets = listQuery.data?.items ?? [];
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const tickets = useMemo(
    () => filterHelpTickets(sourceTickets, activeStatus, normalizedSearchQuery),
    [activeStatus, normalizedSearchQuery, sourceTickets],
  );
  const ticketStatusCounts = useMemo(() => readTicketStatusCounts(sourceTickets), [sourceTickets]);
  const hasActiveFilters = hasHelpTicketFilters(activeStatus, normalizedSearchQuery);
  const emptyMessage = readEmptyTicketMessage(hasActiveFilters);

  return {
    activeStatus,
    emptyMessage,
    hasActiveFilters,
    listQuery,
    searchQuery,
    setActiveStatus,
    setSearchQuery,
    setSortOrder,
    sortOrder,
    ticketStatusCounts,
    tickets,
    totalTicketCount: sourceTickets.length,
  };
}

function useHelpTicketDetailState(notificationPreferences: NotificationPreferences) {
  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);
  const detailQuery = useHelpTicketDetailQuery(detailTicketId);
  const statusMutation = useUpdateHelpTicketStatusMutation();
  const deleteMutation = useDeleteHelpTicketMutation();

  async function handleStatusChange(ticketId: string, status: HelpTicketStatus) {
    await updateHelpTicketStatusAction({
      notificationPreferences,
      status,
      statusMutation,
      ticketId,
    });
  }

  async function handleDeleteTicket(ticketId: string) {
    await deleteHelpTicketAndCollapse({
      deleteMutation,
      expandedTicketId: detailTicketId,
      notificationPreferences,
      onCollapse: setDetailTicketId,
      ticketId,
    });
  }

  return {
    deleteMutation,
    detailQuery,
    detailTicketId,
    handleDeleteTicket,
    handleStatusChange,
    selectedTicket: detailQuery.data,
    setDetailTicketId,
    statusMutation,
  };
}

function useHelpTicketDraftState(notificationPreferences: NotificationPreferences) {
  const [createOpen, setCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<File[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const createMutation = useCreateHelpTicketMutation();
  const createDisabled = isTicketCreateDisabled({
    draftDescription,
    draftError,
    draftTitle,
    isSubmitting: createMutation.isPending,
  });

  async function handleCreateTicket(onCreated: (ticketId: string) => void) {
    await createTicketFromDraft({
      attachments: draftAttachments,
      createMutation,
      description: draftDescription,
      notificationPreferences,
      onCreated,
      onResetDraft: () =>
        resetHelpTicketDraft({
          setDraftAttachments,
          setDraftDescription,
          setDraftError,
          setDraftTitle,
        }),
      onSubmitted: () => setCreateOpen(false),
      title: draftTitle,
    });
  }

  function handleAttachmentsChange(files: FileList | null) {
    updateDraftAttachments({
      files,
      setDraftAttachments,
      setDraftError,
    });
  }

  return {
    createDisabled,
    createMutation,
    createOpen,
    draftAttachments,
    draftDescription,
    draftError,
    draftTitle,
    handleAttachmentsChange,
    handleCreateTicket,
    setCreateOpen,
    setDraftAttachments,
    setDraftDescription,
    setDraftTitle,
  };
}

function readTicketStatusCounts(tickets: { status: HelpTicketStatus }[]): HelpTicketStatusCounts {
  const counts: HelpTicketStatusCounts = {
    all: tickets.length,
    completed: 0,
    in_progress: 0,
    new: 0,
  };

  for (const ticket of tickets) {
    counts[ticket.status] += 1;
  }

  return counts;
}

function readTicketListScope(canManage: boolean) {
  return canManage ? "all" : "mine";
}

function filterHelpTickets(
  tickets: HelpTicketSummary[],
  activeStatus: HelpTicketStatusFilter,
  normalizedSearchQuery: string,
) {
  return tickets.filter(
    (ticket) =>
      ticketMatchesStatus(ticket, activeStatus) &&
      ticketMatchesSearch(ticket, normalizedSearchQuery),
  );
}

function ticketMatchesStatus(ticket: HelpTicketSummary, activeStatus: HelpTicketStatusFilter) {
  return activeStatus === "all" || ticket.status === activeStatus;
}

function ticketMatchesSearch(ticket: HelpTicketSummary, normalizedSearchQuery: string) {
  return (
    !normalizedSearchQuery ||
    ticket.title.toLowerCase().includes(normalizedSearchQuery) ||
    ticket.createdBy.username.toLowerCase().includes(normalizedSearchQuery)
  );
}

function hasHelpTicketFilters(activeStatus: HelpTicketStatusFilter, normalizedSearchQuery: string) {
  return activeStatus !== "all" || Boolean(normalizedSearchQuery);
}

function readEmptyTicketMessage(hasActiveFilters: boolean) {
  return hasActiveFilters ? "No matches." : "No tickets yet.";
}

function isTicketCreateDisabled({
  draftDescription,
  draftError,
  draftTitle,
  isSubmitting,
}: {
  draftDescription: string;
  draftError: string | null;
  draftTitle: string;
  isSubmitting: boolean;
}) {
  return isSubmitting || !draftTitle.trim() || !draftDescription.trim() || Boolean(draftError);
}

function resetHelpTicketDraft({
  setDraftAttachments,
  setDraftDescription,
  setDraftError,
  setDraftTitle,
}: {
  setDraftAttachments: (files: File[]) => void;
  setDraftDescription: (value: string) => void;
  setDraftError: (value: string | null) => void;
  setDraftTitle: (value: string) => void;
}) {
  setDraftTitle("");
  setDraftDescription("");
  setDraftAttachments([]);
  setDraftError(null);
}

function updateDraftAttachments({
  files,
  setDraftAttachments,
  setDraftError,
}: {
  files: FileList | null;
  setDraftAttachments: (files: File[]) => void;
  setDraftError: (value: string | null) => void;
}) {
  const validation = validateHelpTicketDraftFiles(files ? [...files] : []);

  if (!validation.ok) {
    setDraftError(validation.message);
    return;
  }

  setDraftAttachments(validation.files);
  setDraftError(null);
}

async function createTicketFromDraft({
  attachments,
  createMutation,
  description,
  notificationPreferences,
  onCreated,
  onResetDraft,
  onSubmitted,
  title,
}: {
  attachments: File[];
  createMutation: ReturnType<typeof useCreateHelpTicketMutation>;
  description: string;
  notificationPreferences: ReturnType<typeof useAuthenticatedRouteUser>["notificationPreferences"];
  onCreated: (ticketId: string) => void;
  onResetDraft: () => void;
  onSubmitted: () => void;
  title: string;
}) {
  const ticket = await createMutation
    .mutateAsync({
      title: title.trim(),
      description: description.trim(),
      attachments,
    })
    .catch((error) => {
      notify(
        {
          id: "help.ticket.create.failed",
          title: error instanceof Error ? error.message : "Ticket create failed.",
        },
        notificationPreferences,
      );

      return null;
    });

  if (!ticket) {
    return;
  }

  notify(
    {
      id: "help.ticket.created",
      title: "Ticket created.",
    },
    notificationPreferences,
  );
  onSubmitted();
  onResetDraft();
  onCreated(ticket.id);
}

async function updateHelpTicketStatusAction({
  notificationPreferences,
  status,
  statusMutation,
  ticketId,
}: {
  notificationPreferences: ReturnType<typeof useAuthenticatedRouteUser>["notificationPreferences"];
  status: HelpTicketStatus;
  statusMutation: ReturnType<typeof useUpdateHelpTicketStatusMutation>;
  ticketId: string;
}) {
  if (statusMutation.isPending) {
    return;
  }

  await statusMutation
    .mutateAsync({ input: { status }, ticketId })
    .then((ticket) => {
      notify(
        {
          id: "help.ticket.status.updated",
          title: `Status: ${ticket.status.replaceAll("_", " ")}.`,
        },
        notificationPreferences,
      );
    })
    .catch((error) => {
      notify(
        {
          id: "help.ticket.status.failed",
          title: error instanceof Error ? error.message : "Status update failed.",
        },
        notificationPreferences,
      );
    });
}

async function deleteHelpTicketAction({
  deleteMutation,
  notificationPreferences,
  ticketId,
}: {
  deleteMutation: ReturnType<typeof useDeleteHelpTicketMutation>;
  notificationPreferences: ReturnType<typeof useAuthenticatedRouteUser>["notificationPreferences"];
  ticketId: string;
}): Promise<boolean> {
  if (deleteMutation.isPending) {
    return false;
  }

  return await deleteMutation
    .mutateAsync(ticketId)
    .then(() => {
      notify(
        {
          id: "help.ticket.deleted",
          title: "Ticket deleted.",
        },
        notificationPreferences,
      );

      return true;
    })
    .catch((error) => {
      notify(
        {
          id: "help.ticket.delete.failed",
          title: error instanceof Error ? error.message : "Ticket delete failed.",
        },
        notificationPreferences,
      );

      return false;
    });
}

async function deleteHelpTicketAndCollapse({
  deleteMutation,
  expandedTicketId,
  notificationPreferences,
  onCollapse,
  ticketId,
}: {
  deleteMutation: ReturnType<typeof useDeleteHelpTicketMutation>;
  expandedTicketId: string | null;
  notificationPreferences: ReturnType<typeof useAuthenticatedRouteUser>["notificationPreferences"];
  onCollapse: (ticketId: string | null) => void;
  ticketId: string;
}) {
  const deleted = await deleteHelpTicketAction({
    deleteMutation,
    notificationPreferences,
    ticketId,
  });

  if (deleted && expandedTicketId === ticketId) {
    onCollapse(null);
  }
}
