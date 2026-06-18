import type { PublicUser } from "@arrtemplar/shared";
import { createContext, useContext } from "react";

export const AuthenticatedUserContext = createContext<PublicUser | null>(null);

export function useAuthenticatedRouteUser(): PublicUser {
  const user = useContext(AuthenticatedUserContext);

  if (!user) {
    throw new Error("Authenticated route user is only available inside authenticated layouts.");
  }

  return user;
}
