import type {
  DownloadClientKind,
  DownloadClientSavedConfig,
  UpsertDownloadClientRequest,
} from "@arrtemplar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDownloadClientConfig,
  deleteDownloadClientConfigById,
  getDownloadClientStatus,
  getDownloadClientStatusById,
  listDownloadClientConfigs,
  testDownloadClientConfig,
  testDownloadClientConfigById,
  updateDownloadClientConfig,
  upsertDownloadClientConfig,
} from "@/lib/api";

const downloadClientQueryKeys = {
  all: ["download-clients"] as const,
  list: () => [...downloadClientQueryKeys.all, "list"] as const,
  status: (id: string) => [...downloadClientQueryKeys.all, "status", id] as const,
};

export type SaveDownloadClientConfigVariables = {
  config: DownloadClientSavedConfig | undefined;
  input: UpsertDownloadClientRequest;
  kind: DownloadClientKind;
  mode: "default" | "instance";
};

export function useDownloadClientConfigsQuery() {
  return useQuery({
    queryKey: downloadClientQueryKeys.list(),
    queryFn: listDownloadClientConfigs,
    staleTime: 15_000,
  });
}

export function useDownloadClientStatusQuery(
  config: DownloadClientSavedConfig | undefined,
  kind: DownloadClientKind,
  enabled = true,
) {
  const statusId = config?.id ?? kind;

  return useQuery({
    enabled,
    queryKey: downloadClientQueryKeys.status(statusId),
    queryFn: () =>
      config ? getDownloadClientStatusById(config.id) : getDownloadClientStatus(kind),
    staleTime: 15_000,
  });
}

export function useUpsertDownloadClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ config, input, kind, mode }: SaveDownloadClientConfigVariables) => {
      if (!config && mode === "instance") {
        return createDownloadClientConfig(kind, input);
      }

      return !config || config.isDefault
        ? upsertDownloadClientConfig(kind, input)
        : updateDownloadClientConfig(config.id, input);
    },
    onSuccess: async (result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: downloadClientQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: downloadClientQueryKeys.status(result.id) }),
        queryClient.invalidateQueries({ queryKey: downloadClientQueryKeys.status(variables.kind) }),
      ]);
    },
  });
}

export function useDeleteDownloadClientByIdMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDownloadClientConfigById(id),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: downloadClientQueryKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: downloadClientQueryKeys.status(result.deletedId),
        }),
        queryClient.invalidateQueries({
          queryKey: downloadClientQueryKeys.status(result.deletedKind),
        }),
      ]);
    },
  });
}

export function useTestDownloadClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (kind: DownloadClientKind) => testDownloadClientConfig(kind),
    onSuccess: async (_result, kind) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: downloadClientQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: downloadClientQueryKeys.status(kind) }),
      ]);
    },
  });
}

export function useTestDownloadClientByIdMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: DownloadClientSavedConfig) => testDownloadClientConfigById(config.id),
    onSuccess: async (_result, config) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: downloadClientQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: downloadClientQueryKeys.status(config.id) }),
        queryClient.invalidateQueries({ queryKey: downloadClientQueryKeys.status(config.kind) }),
      ]);
    },
  });
}
