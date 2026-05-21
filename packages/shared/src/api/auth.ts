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

export type CreateAdminRequest = {
  username: string;
  email: string;
  password: string;
};

export type CreateLocalUserRequest = {
  username: string;
  email: string;
  password: string;
};

export type LoginResponse = {
  user: PublicUser;
};

export type CreateAdminResponse = {
  user: PublicUser;
};

export type CreateLocalUserResponse = {
  user: PublicUser;
};

export type AuthSetupStatusResponse = {
  required: boolean;
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
