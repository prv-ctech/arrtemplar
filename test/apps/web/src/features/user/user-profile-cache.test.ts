import { describe, expect, it } from "bun:test";
import { authQueryKey } from "../../../../../../apps/web/src/features/auth/auth-state";
import {
  managedUserProfileQueryKey,
  syncUpdatedUserProfileCaches,
  userProfileQueryKey,
} from "../../../../../../apps/web/src/features/user/user-profile-cache";
import {
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  type PublicUser,
} from "../../../../../../packages/shared/src";

const oldUser: PublicUser = {
  id: "user-1",
  username: "old-name",
  email: "old@example.local",
  avatarId: DEFAULT_PROFILE_AVATAR_ID,
  bannerId: DEFAULT_PROFILE_BANNER_ID,
  permissions: ["settings:view"],
  createdAt: "2026-05-22T00:00:00.000Z",
  lastLoginAt: null,
};

const updatedUser: PublicUser = {
  ...oldUser,
  username: "new-name",
  email: "new@example.local",
  avatarId: "demon-slayer-nezuko",
  bannerId: "violet-tide",
};

describe("syncUpdatedUserProfileCaches", () => {
  it("updates both the self profile and current auth user caches after a profile media save", () => {
    const { queryClient, getData } = createQueryClientStub();
    queryClient.setQueryData(userProfileQueryKey, oldUser);
    queryClient.setQueryData(authQueryKey, oldUser);

    syncUpdatedUserProfileCaches(queryClient, updatedUser);

    expect(getData(userProfileQueryKey)).toEqual(updatedUser);
    expect(getData(authQueryKey)).toEqual(updatedUser);
  });

  it("builds scoped cache keys for managed user profile pages", () => {
    expect(managedUserProfileQueryKey("Ab3Xy9Qp2")).toEqual(["users", "profile", "Ab3Xy9Qp2"]);
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
