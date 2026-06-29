import type {
  CreateHelpTicketInput,
  HelpTicketDetail,
  HelpTicketListParams,
  HelpTicketListResponse,
  HelpTicketStatus,
  UpdateHelpTicketStatusRequest,
} from "@arrtemplar/shared";
import { HELP_TICKET_ACCEPTED_UPLOAD_EXTENSIONS, HELP_TICKET_LIMITS } from "@arrtemplar/shared";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHelpTicket,
  deleteHelpTicket,
  getHelpTicket,
  listHelpTickets,
  updateHelpTicketStatus,
} from "@/lib/api/help";
import {
  type NormalizedHelpTicketListParams,
  normalizeHelpTicketListParams,
} from "@/lib/api/normalizers";

const helpTicketKeys = {
  all: ["help-tickets"] as const,
  lists: () => [...helpTicketKeys.all, "list"] as const,
  list: (params: NormalizedHelpTicketListParams) => [...helpTicketKeys.lists(), params] as const,
  details: () => [...helpTicketKeys.all, "detail"] as const,
  detail: (ticketId: string) => [...helpTicketKeys.details(), ticketId] as const,
};

export function helpTicketListQueryOptions(params: HelpTicketListParams) {
  const normalizedParams = normalizeHelpTicketListParams(params);

  return queryOptions({
    queryKey: helpTicketKeys.list(normalizedParams),
    queryFn: () => listHelpTickets(normalizedParams),
    staleTime: 30_000,
  });
}

export function useHelpTicketListQuery(params: HelpTicketListParams) {
  return useQuery(helpTicketListQueryOptions(params));
}

export function useHelpTicketDetailQuery(ticketId: string | null) {
  return useQuery({
    queryKey: helpTicketKeys.detail(ticketId ?? "pending"),
    queryFn: () => getHelpTicket(ticketId ?? ""),
    enabled: Boolean(ticketId),
    staleTime: 30_000,
  });
}

export function useCreateHelpTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateHelpTicketInput & { attachments: File[] }) => createHelpTicket(input),
    onSuccess: (ticket) => {
      queryClient.setQueryData(helpTicketKeys.detail(ticket.id), ticket);
      queryClient.invalidateQueries({ queryKey: helpTicketKeys.lists() });
    },
  });
}

export function useUpdateHelpTicketStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, input }: { ticketId: string; input: UpdateHelpTicketStatusRequest }) =>
      updateHelpTicketStatus(ticketId, input),
    onMutate: async ({ ticketId, input }) => {
      await queryClient.cancelQueries({ queryKey: helpTicketKeys.detail(ticketId) });
      await queryClient.cancelQueries({ queryKey: helpTicketKeys.lists() });
      const previousDetail = queryClient.getQueryData<HelpTicketDetail>(
        helpTicketKeys.detail(ticketId),
      );
      const previousHistoryLists = queryClient.getQueriesData<HelpTicketListResponse>({
        queryKey: helpTicketKeys.lists(),
      });
      const optimisticTimestamp = new Date().toISOString();

      queryClient.setQueryData<HelpTicketDetail | undefined>(
        helpTicketKeys.detail(ticketId),
        (current) =>
          current
            ? {
                ...current,
                status: input.status,
                statusUpdatedAt: optimisticTimestamp,
              }
            : current,
      );
      queryClient.setQueriesData<HelpTicketListResponse>(
        { queryKey: helpTicketKeys.lists() },
        (current) => applyHelpTicketStatusToList(current, ticketId, input.status),
      );

      return { previousDetail, previousHistoryLists };
    },
    onError: (_error, variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(helpTicketKeys.detail(variables.ticketId), context.previousDetail);
      }

      if (context?.previousHistoryLists) {
        for (const [queryKey, previousHistoryList] of context.previousHistoryLists) {
          queryClient.setQueryData(queryKey, previousHistoryList);
        }
      }
    },
    onSuccess: (ticket) => {
      queryClient.setQueryData(helpTicketKeys.detail(ticket.id), ticket);
      queryClient.invalidateQueries({ queryKey: helpTicketKeys.lists() });
    },
  });
}

export function useDeleteHelpTicketMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => deleteHelpTicket(ticketId),
    onMutate: async (ticketId) => {
      await queryClient.cancelQueries({ queryKey: helpTicketKeys.detail(ticketId) });
      await queryClient.cancelQueries({ queryKey: helpTicketKeys.lists() });
      const previousDetail = queryClient.getQueryData<HelpTicketDetail>(
        helpTicketKeys.detail(ticketId),
      );
      const previousHistoryLists = queryClient.getQueriesData<HelpTicketListResponse>({
        queryKey: helpTicketKeys.lists(),
      });

      queryClient.removeQueries({ queryKey: helpTicketKeys.detail(ticketId) });
      queryClient.setQueriesData<HelpTicketListResponse>(
        { queryKey: helpTicketKeys.lists() },
        (current) => applyHelpTicketDeleteToList(current, ticketId),
      );

      return { previousDetail, previousHistoryLists };
    },
    onError: (_error, ticketId, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(helpTicketKeys.detail(ticketId), context.previousDetail);
      }

      if (context?.previousHistoryLists) {
        for (const [queryKey, previousHistoryList] of context.previousHistoryLists) {
          queryClient.setQueryData(queryKey, previousHistoryList);
        }
      }
    },
    onSuccess: (response) => {
      queryClient.removeQueries({ queryKey: helpTicketKeys.detail(response.deletedId) });
      queryClient.invalidateQueries({ queryKey: helpTicketKeys.lists() });
    },
  });
}

export function applyHelpTicketStatusToList(
  list: HelpTicketListResponse | undefined,
  ticketId: string,
  status: HelpTicketStatus,
): HelpTicketListResponse | undefined {
  if (!list) {
    return list;
  }

  return {
    ...list,
    items: list.items.map((ticket) => (ticket.id === ticketId ? { ...ticket, status } : ticket)),
  };
}

export function applyHelpTicketDeleteToList(
  list: HelpTicketListResponse | undefined,
  ticketId: string,
): HelpTicketListResponse | undefined {
  if (!list) {
    return list;
  }

  const items = list.items.filter((ticket) => ticket.id !== ticketId);
  const total = Math.max(0, list.pagination.total - (items.length === list.items.length ? 0 : 1));

  return {
    ...list,
    items,
    pagination: {
      ...list.pagination,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / list.pagination.pageSize),
    },
  };
}

export function validateHelpTicketDraftFiles(
  files: File[],
): { ok: true; files: File[] } | { ok: false; message: string } {
  if (files.length > HELP_TICKET_LIMITS.maxAttachmentCount) {
    return {
      ok: false,
      message: `Up to ${HELP_TICKET_LIMITS.maxAttachmentCount} attachments are allowed.`,
    };
  }

  for (const file of files) {
    if (file.size <= 0 || file.size > HELP_TICKET_LIMITS.maxAttachmentBytes) {
      return {
        ok: false,
        message: `Each attachment must be ${formatHelpTicketFileSize(HELP_TICKET_LIMITS.maxAttachmentBytes)} or smaller.`,
      };
    }

    const lowerName = file.name.toLowerCase();
    if (
      !HELP_TICKET_ACCEPTED_UPLOAD_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
    ) {
      return {
        ok: false,
        message: "Only JPG, PNG, WebP, MP4, WebM, and MOV files are allowed.",
      };
    }
  }

  return { ok: true, files };
}

export function formatHelpTicketFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}
