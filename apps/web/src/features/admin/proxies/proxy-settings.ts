import type { ProxyProfileSummary, UpsertProxyProfileRequest } from "@arrtemplar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProxyProfile,
  deleteProxyProfile,
  listProxyProfiles,
  testProxyProfile,
  updateProxyProfile,
} from "@/lib/api";

const proxySettingsQueryKeys = {
  all: ["proxy-settings"] as const,
  list: () => [...proxySettingsQueryKeys.all, "list"] as const,
};

type SaveProxyProfileVariables = {
  profile?: ProxyProfileSummary | undefined;
  input: UpsertProxyProfileRequest;
};

export function useProxyProfilesQuery() {
  return useQuery({
    queryKey: proxySettingsQueryKeys.list(),
    queryFn: listProxyProfiles,
    staleTime: 15_000,
  });
}

export function useSaveProxyProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profile, input }: SaveProxyProfileVariables) =>
      profile ? updateProxyProfile(profile.id, input) : createProxyProfile(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: proxySettingsQueryKeys.all });
    },
  });
}

export function useDeleteProxyProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proxyProfileId: string) => deleteProxyProfile(proxyProfileId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: proxySettingsQueryKeys.all });
    },
  });
}

export function useTestProxyProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proxyProfileId: string) => testProxyProfile(proxyProfileId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: proxySettingsQueryKeys.all });
    },
  });
}
