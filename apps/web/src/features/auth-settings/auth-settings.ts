import type { AuthProviderSlug, AuthUpsertProviderRequest } from "@arrtemplar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAuthIdentities, listAuthProviders, upsertAuthProvider } from "@/lib/api";

const authProviderQueryKeys = {
  all: ["auth", "providers"] as const,
  identities: () => ["auth", "identities", "me"] as const,
};

export function useAuthProvidersQuery() {
  return useQuery({
    queryKey: authProviderQueryKeys.all,
    queryFn: listAuthProviders,
    staleTime: 60_000,
  });
}

export function useAuthIdentitiesQuery() {
  return useQuery({
    queryKey: authProviderQueryKeys.identities(),
    queryFn: listAuthIdentities,
    staleTime: 60_000,
  });
}

export function useUpsertAuthProviderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, slug }: { input: AuthUpsertProviderRequest; slug: AuthProviderSlug }) =>
      upsertAuthProvider(slug, input),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: authProviderQueryKeys.all });
    },
  });
}
