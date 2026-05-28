import { describe, expect, it } from "bun:test";
import { authQueryKey } from "../../../../../../apps/web/src/features/auth/auth-state";
import {
  syncUpdatedUserProfileCaches,
  userProfileQueryKey,
} from "../../../../../../apps/web/src/features/user/user-profile-cache";
import type { PublicUser } from "../../../../../../packages/shared/src";

const oldUser = {
  id: "user-1",
  username: "old-name",
  email: "old@example.local",
  role: "admin",
  permissions: ["admin:general"],
  createdAt: "2026-05-22T00:00:00.000Z",
  lastLoginAt: null,
} satisfies PublicUser;

const updatedUser = {
  ...oldUser,
  username: "new-name",
  email: "new@example.local",
} satisfies PublicUser;

describe("syncUpdatedUserProfileCaches", () => {
  it("updates both the user profile and current auth user caches after a profile save", () => {
    const { queryClient, getData } = createQueryClientStub();
    queryClient.setQueryData(userProfileQueryKey, oldUser);
    queryClient.setQueryData(authQueryKey, oldUser);

    syncUpdatedUserProfileCaches(queryClient, updatedUser);

    expect(getData(userProfileQueryKey)).toEqual(updatedUser);
    expect(getData(authQueryKey)).toEqual(updatedUser);
  });
});

function createQueryClientStub() {
  const cache = new Map<string, unknown>();
  const keyFor = (queryKey: readonly unknown[]) => JSON.stringify(queryKey);

  return {
    getData(queryKey: readonly unknown[]) {
      return cache.get(keyFor(queryKey));
    },
    queryClient: {
      setQueryData(queryKey: readonly unknown[], value: unknown) {
        cache.set(keyFor(queryKey), value);
      },
    },
  } as {
    getData(queryKey: readonly unknown[]): unknown;
    queryClient: Parameters<typeof syncUpdatedUserProfileCaches>[0];
  };
}
