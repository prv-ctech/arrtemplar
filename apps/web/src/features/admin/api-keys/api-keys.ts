import type { CreateApiKeyRequest } from "@arrtemplar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiKey, deleteApiKey, listApiKeys, rotateApiKey } from "@/lib/api";

const apiKeyQueryKeys = {
  all: ["api-keys"] as const,
  list: () => [...apiKeyQueryKeys.all, "list"] as const,
};

export function useApiKeysQuery() {
  return useQuery({
    queryKey: apiKeyQueryKeys.list(),
    queryFn: listApiKeys,
    staleTime: 15_000,
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateApiKeyRequest) => createApiKey(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
    },
  });
}

export function useRotateApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (apiKeyId: string) => rotateApiKey(apiKeyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
    },
  });
}

export function useDeleteApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (apiKeyId: string) => deleteApiKey(apiKeyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
    },
  });
}
