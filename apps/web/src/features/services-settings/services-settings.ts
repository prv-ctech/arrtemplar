import type {
  ServiceIntegrationKind,
  ServiceIntegrationSavedConfig,
  UpsertServiceIntegrationRequest,
} from "@arrtemplar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createServiceIntegrationConfig,
  deleteServiceIntegrationConfigById,
  getServiceIntegrationStatus,
  getServiceIntegrationStatusById,
  listServiceIntegrationConfigs,
  testServiceIntegrationConfig,
  testServiceIntegrationConfigById,
  updateServiceIntegrationConfig,
  upsertServiceIntegrationConfig,
} from "@/lib/api";

const serviceIntegrationQueryKeys = {
  all: ["service-integrations"] as const,
  list: () => [...serviceIntegrationQueryKeys.all, "list"] as const,
  status: (id: string) => [...serviceIntegrationQueryKeys.all, "status", id] as const,
};

export type SaveServiceIntegrationConfigVariables = {
  config: ServiceIntegrationSavedConfig | undefined;
  input: UpsertServiceIntegrationRequest;
  kind: ServiceIntegrationKind;
  mode: "default" | "instance";
};

export function useServiceIntegrationConfigsQuery() {
  return useQuery({
    queryKey: serviceIntegrationQueryKeys.list(),
    queryFn: listServiceIntegrationConfigs,
    staleTime: 15_000,
  });
}

export function useServiceIntegrationStatusQuery(
  config: ServiceIntegrationSavedConfig | undefined,
  kind: ServiceIntegrationKind,
  enabled = true,
) {
  const statusId = config?.id ?? kind;

  return useQuery({
    enabled,
    queryKey: serviceIntegrationQueryKeys.status(statusId),
    queryFn: () =>
      config ? getServiceIntegrationStatusById(config.id) : getServiceIntegrationStatus(kind),
    staleTime: 15_000,
  });
}

export function useUpsertServiceIntegrationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ config, input, kind, mode }: SaveServiceIntegrationConfigVariables) => {
      if (!config && mode === "instance") {
        return createServiceIntegrationConfig(kind, input);
      }

      return !config || config.isDefault
        ? upsertServiceIntegrationConfig(kind, input)
        : updateServiceIntegrationConfig(config.id, input);
    },
    onSuccess: async (result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceIntegrationQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: serviceIntegrationQueryKeys.status(result.id) }),
        queryClient.invalidateQueries({
          queryKey: serviceIntegrationQueryKeys.status(variables.kind),
        }),
      ]);
    },
  });
}

export function useDeleteServiceIntegrationByIdMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteServiceIntegrationConfigById(id),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceIntegrationQueryKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: serviceIntegrationQueryKeys.status(result.deletedId),
        }),
        queryClient.invalidateQueries({
          queryKey: serviceIntegrationQueryKeys.status(result.deletedKind),
        }),
      ]);
    },
  });
}

export function useTestServiceIntegrationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (kind: ServiceIntegrationKind) => testServiceIntegrationConfig(kind),
    onSuccess: async (_result, kind) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceIntegrationQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: serviceIntegrationQueryKeys.status(kind) }),
      ]);
    },
  });
}

export function useTestServiceIntegrationByIdMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: ServiceIntegrationSavedConfig) =>
      testServiceIntegrationConfigById(config.id),
    onSuccess: async (_result, config) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceIntegrationQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: serviceIntegrationQueryKeys.status(config.id) }),
        queryClient.invalidateQueries({
          queryKey: serviceIntegrationQueryKeys.status(config.kind),
        }),
      ]);
    },
  });
}
