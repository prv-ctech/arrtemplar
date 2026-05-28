import type {
  AdminChangeUserPasswordRequest,
  AdminChangeUserRoleRequest,
  AdminDisableUserRequest,
  AdminUpdateUserPermissionsRequest,
  AdminUpdateUserStatusRequest,
  CreateLocalUserRequest,
} from "@arrtemplar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeAdminUserPassword,
  changeAdminUserRole,
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  getAdminPermissionCatalog,
  listAdminUsers,
  updateAdminUserPermissions,
} from "@/lib/api";

const adminUsersQueryKey = ["admin", "users"] as const;
const adminPermissionCatalogQueryKey = ["admin", "permission-catalog"] as const;

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: adminUsersQueryKey,
    queryFn: listAdminUsers,
    staleTime: 15_000,
  });
}

export function useAdminPermissionCatalogQuery() {
  return useQuery({
    queryKey: adminPermissionCatalogQueryKey,
    queryFn: getAdminPermissionCatalog,
    staleTime: 60_000,
  });
}

export function useCreateAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLocalUserRequest) => createAdminUser(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}

export function useChangeAdminUserPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminChangeUserPasswordRequest }) =>
      changeAdminUserPassword(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}

export function useChangeAdminUserRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminChangeUserRoleRequest }) =>
      changeAdminUserRole(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}

export function useUpdateAdminUserPermissionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, userId }: { userId: string; input: AdminUpdateUserPermissionsRequest }) =>
      updateAdminUserPermissions(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}

export function useDisableAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminDisableUserRequest }) =>
      disableAdminUser(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}

export function useEnableAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminUpdateUserStatusRequest }) =>
      enableAdminUser(userId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}
