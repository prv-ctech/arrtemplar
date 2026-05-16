export type UserRole = "admin" | "user";

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: PublicUser;
};

export type AuthUserResponse = {
  user: PublicUser | null;
};

export type LogoutResponse = {
  status: "ok";
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
