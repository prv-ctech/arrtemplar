import type { PublicUser } from "@arrweeb-anime/shared";

export function getLandingPathForUser(user: PublicUser): "/admin" | "/dashboard" {
  return user.role === "admin" ? "/admin" : "/dashboard";
}
