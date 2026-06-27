import { describe, expect, it } from "bun:test";

const workspaceRoot = new URL("../../../../../../", import.meta.url);
const ticketsPageSourceUrl = new URL("apps/web/src/features/help/TicketsPage.tsx", workspaceRoot);
const ticketListSourceUrl = new URL("apps/web/src/features/help/HelpTicketList.tsx", workspaceRoot);
const ticketCreateDialogSourceUrl = new URL(
  "apps/web/src/features/help/HelpTicketCreateDialog.tsx",
  workspaceRoot,
);
const ticketDetailDialogSourceUrl = new URL(
  "apps/web/src/features/help/HelpTicketDetailDialog.tsx",
  workspaceRoot,
);
const ticketsPageStateSourceUrl = new URL(
  "apps/web/src/features/help/use-help-tickets-page.ts",
  workspaceRoot,
);

describe("tickets page", () => {
  it("replaces the placeholder with real ticket queries, create flow, and detail UI", async () => {
    const source = await Bun.file(ticketsPageSourceUrl).text();
    const listSource = await Bun.file(ticketListSourceUrl).text();
    const createDialogSource = await Bun.file(ticketCreateDialogSourceUrl).text();
    const stateSource = await Bun.file(ticketsPageStateSourceUrl).text();

    expect(stateSource).toContain("useHelpTicketListQuery");
    expect(stateSource).toContain("useCreateHelpTicketMutation");
    expect(stateSource).toContain("useUpdateHelpTicketStatusMutation");
    expect(listSource).toContain("HelpTicketStatusBadge");
    expect(createDialogSource).toContain("JPG, PNG, WebP, MP4, WebM, MOV.");
    expect(source).toContain("Create first ticket.");
    expect(source).toContain("HelpTicketDetailDialog");
    expect(source).toContain("onOpen={setDetailTicketId}");
    expect(source).not.toContain("Coming soon.");
    expect(source).not.toContain("Ticket list pending.");
  });

  it("keeps admin-only reporter and status controls behind the manage helper", async () => {
    const listSource = await Bun.file(ticketListSourceUrl).text();
    const detailSource = await Bun.file(ticketDetailDialogSourceUrl).text();
    const stateSource = await Bun.file(ticketsPageStateSourceUrl).text();

    expect(stateSource).toContain("const canManage = canManageHelpTickets(user)");
    expect(listSource).toContain("{canManage ? <TableHead>Reporter</TableHead> : null}");
    expect(detailSource).toContain("{canManage ? (");
    expect(detailSource).toContain("selectedTicket.createdBy.username");
    expect(detailSource).toContain("HELP_TICKET_STATUS_VALUES.map");
  });
});
