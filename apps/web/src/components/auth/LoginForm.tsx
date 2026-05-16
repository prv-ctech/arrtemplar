import { ArrowRightIcon, LockKeyIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [email, setEmail] = useState("admin@example.local");
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
    <Card className="w-full overflow-hidden bg-card/90 shadow-(--shadow-panel) backdrop-blur-2xl">
      <CardHeader className="gap-5 border-b border-border p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/12 text-primary shadow-(--shadow-soft)">
            <ShieldCheckIcon aria-hidden="true" className="size-6" weight="duotone" />
          </div>
          <span className="rounded-xl border border-border bg-secondary px-3 py-1 font-mono text-xs text-secondary-foreground">
            HTTPS / cookie
          </span>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-[-0.045em]">Access panel</CardTitle>
          <CardDescription className="max-w-[46ch] leading-6">
            Credentials stay on the backend. The browser receives only the HttpOnly session cookie.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={emailId}>Email</Label>
            <Input
              aria-invalid={Boolean(errorMessage)}
              autoComplete="email"
              id={emailId}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={passwordId}>Password</Label>
            <Input
              aria-invalid={Boolean(errorMessage)}
              autoComplete="current-password"
              id={passwordId}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Use the seeded admin password from your local environment.
            </p>
          </div>
          {errorMessage ? (
            <div
              className="rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}
          <Button
            className="h-12 w-full justify-between px-5"
            disabled={loginMutation.isPending}
            type="submit"
          >
            <span className="inline-flex items-center gap-2">
              <LockKeyIcon aria-hidden="true" className="size-4" weight="duotone" />
              {loginMutation.isPending ? "Signing in" : "Sign in"}
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/10">
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
