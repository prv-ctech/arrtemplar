import type { PublicUser } from "@arrtemplar/shared";
import { eq } from "drizzle-orm";
import type { DatabaseClient } from "../db/client";
import { users } from "../db/schema";

export function readAuditActorUserId(
  database: DatabaseClient,
  actor: PublicUser | undefined,
): string | null {
  if (!actor) {
    return null;
  }

  return (
    database.db.select({ id: users.id }).from(users).where(eq(users.publicId, actor.id)).get()
      ?.id ?? null
  );
}
