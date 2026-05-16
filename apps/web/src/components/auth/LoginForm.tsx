import { CaretRightIcon } from "@phosphor-icons/react";
import type { CreateAdminRequest } from "@arrweeb-anime/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ComponentProps, type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLandingPathForUser } from "@/features/auth/auth-navigation";
import { authQueryKey, authSetupQueryKey, useAuthSetupQuery } from "@/features/auth/auth-state";
import { createInitialAdmin, login } from "@/lib/api";
import { ApiClientError } from "@/lib/api-error";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "setup";

export function LoginForm() {
  const form = useAuthFormController();
  const copy = getAuthFormCopy(form.mode);

  return (
    <div className="w-full max-w-sm [@media(max-height:640px)]:max-w-xs">
      <AuthFormHeader description={copy.description} title={copy.title} />
      <form
        className="mt-7 flex flex-col gap-4 [@media(max-height:640px)]:mt-5 [@media(max-height:640px)]:gap-3"
        onSubmit={form.handleSubmit}
      >
        <AuthFields form={form} />
        <AuthErrorMessage message={form.errorMessage} />
        <AuthSubmitButton form={form} />
        {form.mode === "login" ? <PlexSignInPlaceholder /> : null}
      </form>
    </div>
  );
}

function useAuthFormController() {
  const navigate = useNavigate();
  const setupQuery = useAuthSetupQuery();
  const mode: AuthMode = setupQuery.data?.required === true ? "setup" : "login";
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: ({ user }) => {
      queryClient.setQueryData(authQueryKey, user);
      toast.success(`Signed in as ${user.username}.`);
      navigate({ to: getLandingPathForUser(user) });
    },
  });
  const setupMutation = useMutation({
    mutationFn: createInitialAdmin,
    onSuccess: ({ user }) => {
      queryClient.setQueryData(authQueryKey, user);
      queryClient.setQueryData(authSetupQueryKey, { required: false });
      toast.success(`Admin account created for ${user.username}.`);
      navigate({ to: getLandingPathForUser(user) });
    },
  });

  const activeMutation = mode === "setup" ? setupMutation : loginMutation;
  const setupStatusError = setupQuery.error
    ? "Could not check first-run setup. Refresh the page or check the API."
    : null;
  const errorMessage = formError ?? setupStatusError ?? getMutationErrorMessage(activeMutation.error, mode);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

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
    isFormDisabled: setupQuery.isPending || activeMutation.isPending,
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

function AuthFormHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex size-18 items-center justify-center rounded-[1.25rem] border border-border bg-foreground p-3 text-background shadow-(--shadow-soft) [@media(max-height:640px)]:size-14 [@media(max-height:640px)]:rounded-2xl [@media(max-height:640px)]:p-2.5">
        <span
          className="text-xl font-black tracking-[-0.12em] [@media(max-height:640px)]:text-base"
          aria-hidden="true"
        >
          AW
        </span>
      </div>
      <h1 className="mt-7 text-balance text-3xl font-semibold leading-none tracking-[-0.045em] text-foreground [@media(max-height:640px)]:mt-4 [@media(max-height:640px)]:text-2xl">
        {title}
      </h1>
      <p className="mt-3 max-w-xs text-pretty text-sm leading-6 text-muted-foreground">
        {description}
      </p>
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

function AuthTextField({ label, className, ...props }: ComponentProps<typeof Input> & { label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground" htmlFor={props.id}>
        {label}
      </Label>
      <Input className={cn("[@media(max-height:640px)]:h-10", className)} required {...props} />
    </div>
  );
}

function AuthErrorMessage({ message }: { message: string | null }) {
  return message ? (
    <div
      className="rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive [@media(max-height:640px)]:py-2"
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
      className="h-11 w-full rounded-2xl font-semibold [@media(max-height:640px)]:h-10"
      disabled={form.isFormDisabled}
      type="submit"
    >
      {form.isSubmitting ? pending : action}
    </Button>
  );
}

function PlexSignInPlaceholder() {
  return (
    <>
      <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>or continue with</span>
        <div className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/70 px-3 text-sm font-semibold text-secondary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-secondary active:translate-y-0 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70 [@media(max-height:640px)]:h-9"
        disabled
        title="Plex sign-in is not configured for this local build."
        type="button"
      >
        <CaretRightIcon aria-hidden="true" className="size-4 text-primary" weight="bold" />
        <span>Plex</span>
      </button>
    </>
  );
}

function getAuthFormCopy(mode: AuthMode): { title: string; description: string } {
  return mode === "setup"
    ? {
        title: "Create admin",
        description: "No users exist yet. Create the first account to become the administrator.",
      }
    : {
        title: "Arrweeb",
        description: "Sign in to manage requests, automation, and your watch queue.",
      };
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
