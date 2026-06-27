import type { DatabaseClient } from "../db/client";
import { auditLogs } from "../db/schema";

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type DatabaseReader = DatabaseClient["db"] | DatabaseTransaction;

export type AuditLogInput = {
  action: string;
  actorUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  createdAt?: string;
};

export function writeAuditLog(tx: DatabaseReader, input: AuditLogInput): void {
  tx.insert(auditLogs)
    .values({
      id: Bun.randomUUIDv7(),
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      ipAddress: input.ipAddress ?? null,
      createdAt: input.createdAt ?? new Date().toISOString(),
    })
    .run();
}
