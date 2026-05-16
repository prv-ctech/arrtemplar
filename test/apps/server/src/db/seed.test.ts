import { describe, expect, it } from "bun:test";
import { auditLogs, users } from "../../../../../apps/server/src/db/schema";
import { seedAdminUser } from "../../../../../apps/server/src/db/seed";
import {
  openTestDatabase,
  resetTestDatabase,
  TEST_DATABASE_URL,
} from "../../../../helpers/database";

describe("seedAdminUser", () => {
  it("creates one admin user with an Argon2id password hash and is safe to rerun", async () => {
    const password = "correct-horse-battery-staple";

    await resetTestDatabase();

    const firstRun = await seedAdminUser(
      { username: "admin", email: "admin@example.local", password },
      TEST_DATABASE_URL,
    );
    const secondRun = await seedAdminUser(
      { username: "admin", email: "admin@example.local", password },
      TEST_DATABASE_URL,
    );

    const database = openTestDatabase();

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
    await resetTestDatabase();

    await expect(
      seedAdminUser(
        {
          username: "admin",
          email: "admin@example.local",
          password: "change-me-before-running-seed",
        },
        TEST_DATABASE_URL,
      ),
    ).rejects.toThrow("ADMIN_PASSWORD must be changed");
  });
});
