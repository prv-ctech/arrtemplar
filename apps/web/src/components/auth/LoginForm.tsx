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
    <div className="rounded-[2.4rem] border border-white/10 bg-white/[0.035] p-1.5 shadow-[0_40px_100px_-58px_hsl(222_47%_1%)]">
      <Card className="border-white/10 bg-card/90 shadow-none">
        <CardHeader className="gap-4 p-8 pb-6">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <ShieldCheckIcon aria-hidden="true" className="size-6" weight="duotone" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight">Command access</CardTitle>
            <CardDescription className="leading-6">
              Sign in with your server-side session. Credentials stay on the backend; the browser
              only receives an HttpOnly cookie.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor={emailId}>Email</Label>
              <Input
                autoComplete="email"
                id={emailId}
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Password</Label>
              <Input
                autoComplete="current-password"
                id={passwordId}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Use the seeded admin password from your local environment.
              </p>
            </div>
            {errorMessage ? (
              <div
                className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
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
    </div>
  );
}
