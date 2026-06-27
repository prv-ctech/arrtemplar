import { describe, expect, it } from "bun:test";
import {
  applyHelpTicketStatusToList,
  helpTicketListQueryOptions,
  useCreateHelpTicketMutation,
  useHelpTicketDetailQuery,
  useHelpTicketListQuery,
  useUpdateHelpTicketStatusMutation,
  validateHelpTicketDraftFiles,
} from "../../../../../../apps/web/src/features/help/help-ticket-data";
import type { HelpTicketListResponse } from "../../../../../../packages/shared/src";

const workspaceRoot = new URL("../../../../../../", import.meta.url);
const helpTicketDataSourceUrl = new URL(
  "apps/web/src/features/help/help-ticket-data.ts",
  workspaceRoot,
);

const helpTicketList = {
  items: [
    {
      id: "arr1241415",
      title: "Playback issue",
      status: "new",
      attachmentCount: 1,
      createdAt: "2026-06-27T12:00:00.000Z",
      updatedAt: "2026-06-27T12:01:00.000Z",
      createdBy: { id: "HelpUsr01", username: "viewer" },
    },
  ],
  pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
} satisfies HelpTicketListResponse;

describe("help ticket query hooks", () => {
  it("exports the query and mutation hooks used by the tickets page", () => {
    const queryKey = Array.from(
      helpTicketListQueryOptions({ page: 2, pageSize: 10, scope: "all" }).queryKey,
    );

    expect(queryKey).toEqual([
      "help-tickets",
      "list",
      { page: 2, pageSize: 10, scope: "all", sortBy: "createdAt", sortOrder: "desc" },
    ]);
    expect(typeof useHelpTicketListQuery).toBe("function");
    expect(typeof useHelpTicketDetailQuery).toBe("function");
    expect(typeof useCreateHelpTicketMutation).toBe("function");
    expect(typeof useUpdateHelpTicketStatusMutation).toBe("function");
  });

  it("uses TanStack Query optimistic status updates for ticket mutations", async () => {
    const source = await Bun.file(helpTicketDataSourceUrl).text();

    expect(source).toContain("useUpdateHelpTicketStatusMutation");
    expect(source).toContain("queryClient.cancelQueries");
    expect(source).toContain("queryClient.setQueriesData");
    expect(source).toContain("queryClient.invalidateQueries");
    expect(source).toContain("previousHistoryLists");
  });

  it("updates cached ticket statuses without touching unrelated items", () => {
    const updated = applyHelpTicketStatusToList(helpTicketList, "arr1241415", "completed");

    expect(updated?.items[0]?.status).toBe("completed");
    expect(updated?.pagination).toEqual(helpTicketList.pagination);
    expect(applyHelpTicketStatusToList(undefined, "arr1241415", "completed")).toBeUndefined();
  });

  it("validates ticket draft files on the client before upload", () => {
    const accepted = validateHelpTicketDraftFiles([
      new File([new Uint8Array([1, 2, 3])], "capture.png", { type: "image/png" }),
    ]);
    const invalidExtension = validateHelpTicketDraftFiles([
      new File(["svg"], "capture.svg", { type: "image/svg+xml" }),
    ]);

    expect(accepted.ok).toBe(true);
    expect(invalidExtension.ok).toBe(false);
    if (!invalidExtension.ok) {
      expect(invalidExtension.message).toContain("Only JPG, PNG, WebP, MP4, WebM, and MOV");
    }
  });
});
