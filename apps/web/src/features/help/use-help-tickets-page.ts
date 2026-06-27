import type { HelpTicketStatus } from "@arrtemplar/shared";
import { useState } from "react";
import { canManageHelpTickets } from "@/features/auth/auth-state";
import { notify } from "@/features/notifications/notification-gateway";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import {
  useCreateHelpTicketMutation,
  useHelpTicketDetailQuery,
  useHelpTicketListQuery,
  useUpdateHelpTicketStatusMutation,
  validateHelpTicketDraftFiles,
} from "./help-ticket-data";

export function useHelpTicketsPageState() {
  const user = useAuthenticatedRouteUser();
  const canManage = canManageHelpTickets(user);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<File[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const listQuery = useHelpTicketListQuery({ scope: canManage ? "all" : "mine" });
  const detailQuery = useHelpTicketDetailQuery(detailTicketId);
  const createMutation = useCreateHelpTicketMutation();
  const statusMutation = useUpdateHelpTicketStatusMutation();
  const selectedTicket = detailQuery.data;
  const tickets = listQuery.data?.items ?? [];
  const emptyMessage = canManage ? "No tickets yet." : "No tickets yet.";
  const createDisabled =
    createMutation.isPending ||
    !draftTitle.trim() ||
    !draftDescription.trim() ||
    Boolean(draftError);

  function resetDraft() {
    setDraftTitle("");
    setDraftDescription("");
    setDraftAttachments([]);
    setDraftError(null);
  }

  async function handleCreateTicket() {
    const result = await createMutation
      .mutateAsync({
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        attachments: draftAttachments,
      })
      .catch((error) => {
        notify(
          {
            id: "help.ticket.create.failed",
            title: error instanceof Error ? error.message : "Ticket create failed.",
          },
          user.notificationPreferences,
        );

        return null;
      });

    if (!result) {
      return;
    }

    notify(
      {
        id: "help.ticket.created",
        title: "Ticket created.",
      },
      user.notificationPreferences,
    );
    setCreateOpen(false);
    resetDraft();
    setDetailTicketId(result.id);
  }

  function handleAttachmentsChange(files: FileList | null) {
    const nextFiles = files ? [...files] : [];
    const validation = validateHelpTicketDraftFiles(nextFiles);

    if (!validation.ok) {
      setDraftError(validation.message);
      return;
    }

    setDraftAttachments(validation.files);
    setDraftError(null);
  }

  async function handleStatusChange(status: HelpTicketStatus) {
    if (!selectedTicket || statusMutation.isPending) {
      return;
    }

    await statusMutation
      .mutateAsync({ input: { status }, ticketId: selectedTicket.id })
      .then((ticket) => {
        notify(
          {
            id: "help.ticket.status.updated",
            title: `Status: ${ticket.status.replaceAll("_", " ")}.`,
          },
          user.notificationPreferences,
        );
      })
      .catch((error) => {
        notify(
          {
            id: "help.ticket.status.failed",
            title: error instanceof Error ? error.message : "Status update failed.",
          },
          user.notificationPreferences,
        );
      });
  }

  return {
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
  };
}
