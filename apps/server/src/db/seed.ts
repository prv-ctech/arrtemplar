import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { createDatabase, type DatabaseClient } from "./client";
import { auditLogs, users } from "./schema";

const ADMIN_PASSWORD_PLACEHOLDER = "change-me-before-running-seed";
const MIN_ADMIN_PASSWORD_LENGTH = 12;

export type AdminSeedInput = {
  username: string;
  email: string;
  password: string;
};

export type AdminSeedResult = {
  status: "created" | "already_exists" | "promoted";
  userId: string;
};

export async function seedAdminUser(
  input: AdminSeedInput,
  databaseUrl = env.databaseUrl,
): Promise<AdminSeedResult> {
  validateAdminSeedInput(input);

  const database = createDatabase(databaseUrl);

  try {
    return await seedAdminUserWithDatabase(input, database);
  } finally {
    database.close();
  }
}

export async function seedAdminUserWithDatabase(
  input: AdminSeedInput,
  database: DatabaseClient,
): Promise<AdminSeedResult> {
  const existingByEmail = database.db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .get();
  const existingByUsername = database.db
    .select()
    .from(users)
    .where(eq(users.username, input.username))
    .get();

  if (existingByEmail && existingByUsername && existingByEmail.id !== existingByUsername.id) {
    throw new Error("Admin seed email and username belong to different existing users.");
  }

  const existing = existingByEmail ?? existingByUsername;

  if (existing) {
    if (existing.email !== input.email || existing.username !== input.username) {
      throw new Error("Admin seed conflicts with an existing user email or username.");
    }

    if (existing.role !== "admin") {
      database.db
        .update(users)
        .set({ role: "admin", updatedAt: new Date().toISOString() })
        .where(eq(users.id, existing.id))
        .run();

      return { status: "promoted", userId: existing.id };
    }

    return { status: "already_exists", userId: existing.id };
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await Bun.password.hash(input.password, { algorithm: "argon2id" });

  database.db
    .insert(users)
    .values({
      id: userId,
      username: input.username,
      email: input.email,
      passwordHash,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  database.db
    .insert(auditLogs)
    .values({
      id: crypto.randomUUID(),
      actorUserId: userId,
      action: "admin.seed.created",
      targetType: "user",
      targetId: userId,
      metadataJson: JSON.stringify({ username: input.username, email: input.email }),
      createdAt: now,
    })
    .run();

  return { status: "created", userId };
}

export function readAdminSeedInput(
  environment: Record<string, string | undefined>,
): AdminSeedInput {
  return {
    username: readRequiredEnv(environment, "ADMIN_USERNAME"),
    email: readRequiredEnv(environment, "ADMIN_EMAIL"),
    password: readRequiredEnv(environment, "ADMIN_PASSWORD"),
  };
}

function readRequiredEnv(environment: Record<string, string | undefined>, key: string): string {
  const value = environment[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required to seed the first admin user.`);
  }

  return value;
}

function validateAdminSeedInput(input: AdminSeedInput): void {
  if (!input.email.includes("@")) {
    throw new Error("ADMIN_EMAIL must be a valid email-like value.");
  }

  if (input.password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`);
  }

  if (
    input.password === ADMIN_PASSWORD_PLACEHOLDER ||
    input.password.toLowerCase().includes("change-me")
  ) {
    throw new Error("ADMIN_PASSWORD must be changed before running the seed command.");
  }
}

if (import.meta.main) {
  const result = await seedAdminUser(readAdminSeedInput(Bun.env));
  console.info(`Admin seed ${result.status}: ${result.userId}`);
}
