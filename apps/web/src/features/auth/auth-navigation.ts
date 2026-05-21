import type { PublicUser } from "@arrtemplar/shared";

export function getLandingPathForUser(user: PublicUser): "/admin" | "/dashboard" {
  return user.role === "admin" ? "/admin" : "/dashboard";
}
