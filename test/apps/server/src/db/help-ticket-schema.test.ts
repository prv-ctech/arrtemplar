import { afterEach, describe, expect, it } from "bun:test";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import {
  helpTicketAttachments,
  helpTickets,
  users,
} from "../../../../../apps/server/src/db/schema";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";

let database: DatabaseClient | null = null;

afterEach(() => {
  database?.close();
  database = null;
});

describe("help ticket schema", () => {
  it("creates help ticket tables and indexes in the migrated test database", async () => {
    database = await resetAndOpenTestDatabase();

    const tables = database.sqlite
      .query<{ name: string }, []>(
        "select name from sqlite_master where type = 'table' and name in ('help_tickets', 'help_ticket_attachments') order by name",
      )
      .all()
      .map((row) => row.name);
    const attachmentIndexes = database.sqlite
      .query<{ name: string }, []>("PRAGMA index_list('help_ticket_attachments')")
      .all()
      .map((row) => row.name);

    expect(tables).toEqual(["help_ticket_attachments", "help_tickets"]);
    expect(attachmentIndexes).toContain("help_ticket_attachments_ticket_id_idx");
  });

  it("applies help ticket defaults and cascades attachment deletion", async () => {
    database = await resetAndOpenTestDatabase();
    const userId = Bun.randomUUIDv7();
    const ticketId = "arr1241415";
    const attachmentId = Bun.randomUUIDv7();
    const now = new Date().toISOString();

    database.db
      .insert(users)
      .values({
        id: userId,
        publicId: "HelpUser001",
        username: "help-user",
        email: "help-user@example.local",
        passwordHash: "hash-for-help-ticket-schema-test",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    database.db
      .insert(helpTickets)
      .values({
        id: ticketId,
        createdByUserId: userId,
        title: "Need help",
        description: "Ticket body",
        statusUpdatedByUserId: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    database.db
      .insert(helpTicketAttachments)
      .values({
        id: attachmentId,
        ticketId,
        uploadedByUserId: userId,
        originalFileName: "capture.png",
        storedFileName: `${attachmentId}.webp`,
        mediaKind: "image",
        mimeType: "image/webp",
        sizeBytes: 1_024,
        storedSizeBytes: 768,
        width: 1280,
        height: 720,
        sha256: "deadbeef",
        scanStatus: "not_configured",
      })
      .run();

    const ticket = database.db
      .select()
      .from(helpTickets)
      .all()
      .find((row) => row.id === ticketId);
    const attachmentCountBeforeDelete = database.db
      .select()
      .from(helpTicketAttachments)
      .all()
      .filter((row) => row.ticketId === ticketId).length;

    expect(ticket?.status).toBe("new");
    expect(ticket?.statusUpdatedAt).toEqual(expect.any(String));
    expect(attachmentCountBeforeDelete).toBe(1);

    database.sqlite.query("delete from help_tickets where id = ?").run(ticketId);

    const attachmentCountAfterDelete = database.db
      .select()
      .from(helpTicketAttachments)
      .all()
      .filter((row) => row.ticketId === ticketId).length;

    expect(attachmentCountAfterDelete).toBe(0);
  });
});
