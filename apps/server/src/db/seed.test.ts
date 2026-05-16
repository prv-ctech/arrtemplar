import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "./client";
import { migrateDatabase } from "./migrate";
import { auditLogs, users } from "./schema";
import { seedAdminUser } from "./seed";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("seedAdminUser", () => {
  it("creates one admin user with an Argon2id password hash and is safe to rerun", async () => {
    const databaseUrl = createTempDatabaseUrl();
    const password = "correct-horse-battery-staple";

    migrateDatabase(databaseUrl);

    const firstRun = await seedAdminUser(
      { username: "admin", email: "admin@example.local", password },
      databaseUrl,
    );
    const secondRun = await seedAdminUser(
      { username: "admin", email: "admin@example.local", password },
      databaseUrl,
    );

    const database = createDatabase(databaseUrl);

    try {
      const seededUsers = database.db.select().from(users).all();
      const seededAuditLogs = database.db.select().from(auditLogs).all();
      const [admin] = seededUsers;

      expect(firstRun.status).toBe("created");
      expect(secondRun.status).toBe("already_exists");
      expect(firstRun.userId).toBe(secondRun.userId);
      expect(seededUsers).toHaveLength(1);
      expect(admin?.role).toBe("admin");
      expect(admin?.passwordHash).toStartWith("$argon2id$");
      expect(admin?.passwordHash).not.toBe(password);
      expect(await Bun.password.verify(password, admin?.passwordHash ?? "")).toBe(true);
      expect(seededAuditLogs).toHaveLength(1);
      expect(seededAuditLogs[0]?.action).toBe("admin.seed.created");
    } finally {
      database.close();
    }
  });

  it("rejects placeholder admin passwords", async () => {
    const databaseUrl = createTempDatabaseUrl();

    migrateDatabase(databaseUrl);

    await expect(
      seedAdminUser(
        {
          username: "admin",
          email: "admin@example.local",
          password: "change-me-before-running-seed",
        },
        databaseUrl,
      ),
    ).rejects.toThrow("ADMIN_PASSWORD must be changed");
  });
});

function createTempDatabaseUrl(): string {
  const directory = mkdtempSync(join(tmpdir(), "arrweeb-anime-seed-"));
  tempDirectories.push(directory);

  return join(directory, "arrweeb-anime.sqlite");
}
