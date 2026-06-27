import { afterEach, describe, expect, it } from "bun:test";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { helpTickets, users } from "../../../../../apps/server/src/db/schema";
import { HelpTicketService } from "../../../../../apps/server/src/help/ticket.service";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  type PublicUser,
} from "../../../../../packages/shared/src";
import { resetAndOpenTestDatabase } from "../../../../helpers/database";

let database: DatabaseClient | null = null;

afterEach(() => {
  database?.close();
  database = null;
});

describe("help ticket service", () => {
  it("retries ticket id generation when a candidate already exists", async () => {
    database = await resetAndOpenTestDatabase();
    const now = new Date().toISOString();
    const actorUserId = Bun.randomUUIDv7();
    const existingTicketId = "arr1241415";
    const createdTicketId = "arr7654321";
    const actor: PublicUser = {
      id: "HelpMgr01",
      username: "helper",
      email: "helper@example.local",
      avatarId: DEFAULT_PROFILE_AVATAR_ID,
      bannerId: DEFAULT_PROFILE_BANNER_ID,
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      permissions: [...DEFAULT_SIGNED_IN_USER_PERMISSIONS],
      createdAt: now,
      lastLoginAt: null,
    };

    database.db
      .insert(users)
      .values({
        id: actorUserId,
        publicId: actor.id,
        username: actor.username,
        email: actor.email,
        passwordHash: "hash-for-help-ticket-service-test",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    database.db
      .insert(helpTickets)
      .values({
        id: existingTicketId,
        createdByUserId: actorUserId,
        title: "Existing ticket",
        description: "Already here",
        status: "new",
        statusUpdatedAt: now,
        statusUpdatedByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const service = new HelpTicketService(
      database,
      {
        async deleteTicketStorage() {},
        async prepareAttachments() {
          return { ok: true, value: [] } as const;
        },
        async readStoredAttachment() {
          return null;
        },
        async storePreparedAttachments() {
          return { ok: true, value: undefined } as const;
        },
      } as unknown as import("../../../../../apps/server/src/help/attachment.service").HelpTicketAttachmentService,
      (() => {
        const candidates = [existingTicketId, createdTicketId];
        return () => candidates.shift() ?? createdTicketId;
      })(),
    );

    const result = await service.createTicket({
      actor,
      attachments: [],
      context: {
        ipAddress: "127.0.0.1",
        path: "/api/help/tickets",
        userAgent: "bun-test",
      },
      description: "Need a fresh id",
      title: "Collision test",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.ticket.id).toBe(createdTicketId);
    }
  });
});
