import type {
  AdminChangeUserPasswordRequest,
  AdminDisableUserRequest,
  AdminUpdateUserPermissionsRequest,
  AdminUpdateUserStatusRequest,
  CreateLocalUserRequest,
} from "@arrtemplar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeManagedUserPassword,
  createUser,
  deleteManagedUser,
  getPermissionCatalog,
  listUsers,
  updateManagedUserPermissions,
  updateManagedUserStatus,
} from "@/lib/api";

const usersQueryKey = ["users", "directory"] as const;
const permissionCatalogQueryKey = ["permissions", "catalog"] as const;

export function useUsersQuery() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: listUsers,
    staleTime: 15_000,
  });
}

export function usePermissionCatalogQuery() {
  return useQuery({
    queryKey: permissionCatalogQueryKey,
    queryFn: getPermissionCatalog,
    staleTime: 60_000,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLocalUserRequest) => createUser(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}

export function useChangeManagedUserPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminChangeUserPasswordRequest }) =>
      changeManagedUserPassword(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}

export function useUpdateManagedUserPermissionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, userId }: { userId: string; input: AdminUpdateUserPermissionsRequest }) =>
      updateManagedUserPermissions(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}

export function useDisableManagedUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminDisableUserRequest }) =>
      updateManagedUserStatus(userId, { disabled: true, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}

export function useUpdateManagedUserStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminUpdateUserStatusRequest }) =>
      updateManagedUserStatus(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}

export function useDeleteManagedUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => deleteManagedUser(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
  });
}
