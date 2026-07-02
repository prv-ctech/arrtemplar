import type { CreateAdminRequest } from "@arrtemplar/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ComponentProps, type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AuthMode, resolveAuthMode } from "@/features/auth/auth-mode";
import { getLandingPathForUser } from "@/features/auth/auth-navigation";
import { authQueryKey, authSetupQueryKey, useAuthSetupQuery } from "@/features/auth/auth-state";
import { notify } from "@/features/notifications/notification-gateway";
import { createInitialAdmin, login } from "@/lib/api";
import { ApiClientError } from "@/lib/api-error";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const form = useAuthFormController();

  if (form.mode === null) {
    return (
      <AuthCard title="Checking setup">
        {form.errorMessage ? (
          <AuthErrorMessage message={form.errorMessage} />
        ) : (
          <AuthStatusMessage />
        )}
      </AuthCard>
    );
  }

  const copy = getAuthFormCopy(form.mode);

  return (
    <AuthCard title={copy.title}>
      <form className="grid gap-4" onSubmit={form.handleSubmit}>
        <AuthFields form={form} />
        <AuthErrorMessage message={form.errorMessage} />
        <AuthSubmitButton form={form} />
      </form>
    </AuthCard>
  );
}

function useAuthFormController() {
  const navigate = useNavigate();
  const setupQuery = useAuthSetupQuery();
  const mode = resolveAuthMode(setupQuery.data, setupQuery.isPending || setupQuery.isFetching);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: ({ user }) => {
      queryClient.setQueryData(authQueryKey, user);
      notify(
        {
          id: "auth.signed_in",
          title: `Signed in as ${user.username}.`,
        },
        user.notificationPreferences,
      );
      navigate({ to: getLandingPathForUser(user) });
    },
  });
  const setupMutation = useMutation({
    mutationFn: createInitialAdmin,
    onSuccess: ({ user }) => {
      queryClient.setQueryData(authQueryKey, user);
      queryClient.setQueryData(authSetupQueryKey, { required: false });
      notify(
        {
          id: "auth.admin.created",
          title: `Admin account created for ${user.username}.`,
        },
        user.notificationPreferences,
      );
      navigate({ to: getLandingPathForUser(user) });
    },
  });

  const activeMutation = mode === "setup" ? setupMutation : loginMutation;
  const setupStatusError = setupQuery.error
    ? "Could not check first-run setup. Refresh the page or check the API."
    : null;
  const mutationErrorMessage = mode ? getMutationErrorMessage(activeMutation.error, mode) : null;
  const errorMessage = formError ?? setupStatusError ?? mutationErrorMessage;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (mode === null) {
      return;
    }

    if (mode === "setup") {
      submitSetupForm({ username, email, password, confirmPassword, setupMutation, setFormError });
      return;
    }

    loginMutation.mutate({ email, password });
  }

  return {
    mode,
    username,
    setUsername,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    errorMessage,
    isFormDisabled: mode === null || setupQuery.isFetching || activeMutation.isPending,
    isSubmitting: activeMutation.isPending,
    handleSubmit,
  };
}

type AuthFormController = ReturnType<typeof useAuthFormController>;

function submitSetupForm(input: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  setupMutation: { mutate: (next: CreateAdminRequest) => void };
  setFormError: (message: string) => void;
}): void {
  if (input.password !== input.confirmPassword) {
    input.setFormError("Passwords do not match.");
    return;
  }

  input.setupMutation.mutate({
    username: input.username,
    email: input.email,
    password: input.password,
  });
}

function AuthCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-center gap-2 text-foreground">
        <span className="text-sm font-black tracking-[-0.14em]" aria-hidden="true">
          AW
        </span>
        <span className="text-base font-semibold tracking-tight">Arrtemplar</span>
      </div>
      <Card className="rounded-lg border-border bg-card/92 shadow-none backdrop-blur-xl">
        <CardHeader className="p-6 pb-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </CardHeader>
        <CardContent className="p-6 pt-0">{children}</CardContent>
      </Card>
    </div>
  );
}

function AuthFields({ form }: { form: AuthFormController }) {
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const hasError = Boolean(form.errorMessage);

  return (
    <>
      {form.mode === "setup" ? (
        <AuthTextField
          autoComplete="username"
          disabled={form.isFormDisabled}
          id={usernameId}
          label="Username"
          name="username"
          onChange={(event) => form.setUsername(event.target.value)}
          placeholder="Username"
          value={form.username}
        />
      ) : null}
      <AuthTextField
        aria-invalid={hasError}
        autoComplete="email"
        disabled={form.isFormDisabled}
        id={emailId}
        inputMode="email"
        label="Email"
        name="email"
        onChange={(event) => form.setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        value={form.email}
      />
      <AuthTextField
        aria-invalid={hasError}
        autoComplete={form.mode === "setup" ? "new-password" : "current-password"}
        disabled={form.isFormDisabled}
        id={passwordId}
        label="Password"
        name="password"
        onChange={(event) => form.setPassword(event.target.value)}
        placeholder="Password"
        type="password"
        value={form.password}
      />
      {form.mode === "setup" ? (
        <AuthTextField
          aria-invalid={hasError}
          autoComplete="new-password"
          disabled={form.isFormDisabled}
          id={confirmPasswordId}
          label="Confirm password"
          name="confirmPassword"
          onChange={(event) => form.setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          type="password"
          value={form.confirmPassword}
        />
      ) : null}
    </>
  );
}

function AuthTextField({
  label,
  className,
  ...props
}: ComponentProps<typeof Input> & { label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={props.id}>{label}</Label>
      <Input
        className={cn(
          "h-10 rounded-md border-border bg-background px-3 text-sm shadow-none focus-visible:bg-background",
          className,
        )}
        required
        {...props}
      />
    </div>
  );
}

function AuthErrorMessage({ message }: { message: string | null }) {
  return message ? (
    <div
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm leading-5 text-destructive"
      role="alert"
    >
      {message}
    </div>
  ) : null;
}

function AuthSubmitButton({ form }: { form: AuthFormController }) {
  const action = form.mode === "setup" ? "Create admin" : "Sign in";
  const pending = form.mode === "setup" ? "Creating admin" : "Signing in";

  return (
    <Button
      className="h-10 w-full rounded-md font-medium"
      disabled={form.isFormDisabled}
      type="submit"
    >
      {form.isSubmitting ? pending : action}
    </Button>
  );
}

function getAuthFormCopy(mode: AuthMode): { title: string } {
  return mode === "setup"
    ? {
        title: "Create admin",
      }
    : {
        title: "Sign in",
      };
}

function AuthStatusMessage() {
  return (
    <div
      aria-live="polite"
      className="rounded-md border border-border bg-secondary/45 px-3 py-2 text-center text-sm leading-5 text-muted-foreground"
    >
      Checking setup…
    </div>
  );
}

function getMutationErrorMessage(error: Error | null, mode: AuthMode): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof ApiClientError) {
    return error.message;
  }

  return mode === "setup"
    ? "Admin setup failed. Check the API and try again."
    : "Login failed. Check the API and try again.";
}
