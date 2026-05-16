import { CaretRightIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLandingPathForUser } from "@/features/auth/auth-navigation";
import { authQueryKey } from "@/features/auth/auth-state";
import { login } from "@/lib/api";
import { ApiClientError } from "@/lib/api-error";
import { queryClient } from "@/lib/query-client";

export function LoginForm() {
  const emailId = useId();
  const passwordId = useId();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: ({ user }) => {
      queryClient.setQueryData(authQueryKey, user);
      toast.success(`Signed in as ${user.username}.`);
      navigate({ to: getLandingPathForUser(user) });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  }

  const errorMessage = loginMutation.error
    ? loginMutation.error instanceof ApiClientError
      ? loginMutation.error.message
      : "Login failed. Check the API and try again."
    : null;

  return (
    <div className="w-full max-w-sm [@media(max-height:640px)]:max-w-xs">
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
          Arrweeb
        </h1>
      </div>

      <form
        className="mt-7 flex flex-col gap-4 [@media(max-height:640px)]:mt-5 [@media(max-height:640px)]:gap-3"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground" htmlFor={emailId}>
            Email
          </Label>
          <Input
            aria-invalid={Boolean(errorMessage)}
            autoComplete="email"
            className="[@media(max-height:640px)]:h-10"
            id={emailId}
            inputMode="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            type="email"
            value={email}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground" htmlFor={passwordId}>
            Password
          </Label>
          <Input
            aria-invalid={Boolean(errorMessage)}
            autoComplete="current-password"
            className="[@media(max-height:640px)]:h-10"
            id={passwordId}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            type="password"
            value={password}
          />
        </div>

        {errorMessage ? (
          <div
            className="rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive [@media(max-height:640px)]:py-2"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <Button
          className="h-11 w-full rounded-2xl font-semibold [@media(max-height:640px)]:h-10"
          disabled={loginMutation.isPending}
          type="submit"
        >
          {loginMutation.isPending ? "Signing in" : "Sign in"}
        </Button>

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
      </form>
    </div>
  );
}
