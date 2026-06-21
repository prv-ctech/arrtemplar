import {
  AUTH_PROVIDER_SLUGS,
  type AuthIdentity,
  type AuthProviderSummary,
  type AuthUpsertProviderRequest,
} from "@arrtemplar/shared";
import { FingerprintIcon } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SettingsRow,
  SettingsSection,
  SettingsStatus,
} from "@/features/settings/SettingsPrimitives";
import { cn } from "@/lib/utils";
import {
  useAuthIdentitiesQuery,
  useAuthProvidersQuery,
  useUpsertAuthProviderMutation,
} from "./auth-settings";

type AuthProviderFormState = {
  label: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  redirectUris: string;
  enabled: boolean;
};

const authProviderSlug = AUTH_PROVIDER_SLUGS[0];

export function AuthSettings() {
  const controls = useAuthSettingsController();

  return (
    <div className="space-y-6">
      <AuthProviderCard controls={controls} />
      <LinkedIdentitiesCard
        identities={controls.identities}
        isProviderEnabled={Boolean(controls.provider?.enabled)}
      />
    </div>
  );
}

function useAuthSettingsController() {
  const providersQuery = useAuthProvidersQuery();
  const identitiesQuery = useAuthIdentitiesQuery();
  const provider = providersQuery.data?.find((candidate) => candidate.slug === authProviderSlug);
  const [form, setForm] = useState(() => createFormState(provider));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const saveMutation = useUpsertAuthProviderMutation();
  const statusId = useId();
  const isSaving = saveMutation.isPending;
  const errorMessage = formError ?? getErrorMessage(providersQuery.error ?? saveMutation.error);

  useEffect(() => {
    setForm(createFormState(provider));
  }, [provider]);

  function updateForm(next: Partial<AuthProviderFormState>) {
    setStatusMessage(null);
    setFormError(null);
    setForm((current) => ({ ...current, ...next }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setStatusMessage(null);

    const request = createProviderRequest(form);

    if (!request) {
      setFormError("Complete issuer, client ID, scopes, and redirect URI.");
      return;
    }

    if (!provider?.hasClientSecret && !request.clientSecret) {
      setFormError("Enter the Authentik client secret before saving.");
      return;
    }

    saveMutation.mutate(
      { slug: authProviderSlug, input: request },
      {
        onSuccess: () => {
          setForm((current) => ({ ...current, clientSecret: "" }));
          setStatusMessage("Auth provider saved.");
        },
      },
    );
  }

  return {
    errorMessage,
    form,
    handleSubmit,
    identities: identitiesQuery.data ?? [],
    isSaving,
    provider,
    statusId,
    statusMessage: isSaving ? "Saving auth provider" : statusMessage,
    updateForm,
  };
}

type AuthSettingsController = ReturnType<typeof useAuthSettingsController>;

function AuthProviderCard({ controls }: { controls: AuthSettingsController }) {
  return (
    <Card className="shadow-(--shadow-panel)">
      <CardHeader>
        <CardTitle>Auth</CardTitle>
        <CardDescription>Configure native Authentik login.</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthProviderForm controls={controls} />
      </CardContent>
    </Card>
  );
}

function AuthProviderForm({ controls }: { controls: AuthSettingsController }) {
  return (
    <form className="space-y-4" onSubmit={controls.handleSubmit}>
      <AuthProviderSection controls={controls} />
      <SettingsStatus
        errorMessage={controls.errorMessage}
        statusId={controls.statusId}
        statusMessage={controls.statusMessage}
      />
      <AuthProviderSaveButton controls={controls} />
    </form>
  );
}

function AuthProviderSection({ controls }: { controls: AuthSettingsController }) {
  return (
    <SettingsSection density="compact" title="Authentik provider">
      <ProviderStatusRow
        enabled={controls.form.enabled}
        {...(controls.provider ? { provider: controls.provider } : {})}
      />
      <ProviderEnabledRow
        disabled={controls.isSaving}
        enabled={controls.form.enabled}
        onChange={(enabled) => controls.updateForm({ enabled })}
        statusId={controls.statusId}
      />

      {controls.form.enabled ? (
        <ProviderConfigRows
          disabled={controls.isSaving}
          form={controls.form}
          onChange={controls.updateForm}
        />
      ) : null}
    </SettingsSection>
  );
}

function AuthProviderSaveButton({ controls }: { controls: AuthSettingsController }) {
  if (!controls.form.enabled && !controls.provider) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <Button className="rounded-xl" disabled={controls.isSaving} size="sm" type="submit">
        {controls.isSaving ? "Saving" : "Save Authentik"}
      </Button>
    </div>
  );
}

function ProviderStatusRow({
  provider,
  enabled,
}: {
  provider?: AuthProviderSummary;
  enabled: boolean;
}) {
  return (
    <SettingsRow density="compact" label="Status">
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-sm text-muted-foreground">
        <Badge variant={enabled ? "default" : "secondary"}>
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
        <span className="truncate">
          {provider ? `Saved ${new Date(provider.updatedAt).toLocaleDateString()}` : "Not saved"}
        </span>
      </div>
    </SettingsRow>
  );
}

function ProviderEnabledRow({
  disabled,
  enabled,
  onChange,
  statusId,
}: {
  disabled: boolean;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  statusId: string;
}) {
  return (
    <SettingsRow controlId="auth-provider-enabled" density="compact" label="Provider">
      <label
        className={cn(
          "inline-flex min-w-24 cursor-pointer items-center justify-end gap-2 text-sm font-medium",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          aria-describedby={statusId}
          checked={enabled}
          className="peer sr-only"
          disabled={disabled}
          id="auth-provider-enabled"
          onChange={(event) => onChange(event.currentTarget.checked)}
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className="relative h-5 w-9 rounded-full border border-border bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary/60 peer-checked:bg-primary peer-checked:after:translate-x-4"
        />
        <span className="text-foreground">{enabled ? "On" : "Off"}</span>
      </label>
    </SettingsRow>
  );
}

function ProviderConfigRows({
  disabled,
  form,
  onChange,
}: {
  disabled: boolean;
  form: AuthProviderFormState;
  onChange: (next: Partial<AuthProviderFormState>) => void;
}) {
  const fieldClassName = "h-9 rounded-xl px-3 text-sm";

  return (
    <>
      <SettingsRow controlId="auth-provider-issuer" density="compact" label="Issuer">
        <Input
          className={fieldClassName}
          disabled={disabled}
          id="auth-provider-issuer"
          onChange={(event) => onChange({ issuer: event.currentTarget.value })}
          placeholder="Issuer URL from your provider"
          value={form.issuer}
        />
      </SettingsRow>
      <SettingsRow controlId="auth-provider-client-id" density="compact" label="Client ID">
        <Input
          className={fieldClassName}
          disabled={disabled}
          id="auth-provider-client-id"
          onChange={(event) => onChange({ clientId: event.currentTarget.value })}
          value={form.clientId}
        />
      </SettingsRow>
      <SettingsRow controlId="auth-provider-client-secret" density="compact" label="Client secret">
        <Input
          autoComplete="off"
          className={fieldClassName}
          disabled={disabled}
          id="auth-provider-client-secret"
          onChange={(event) => onChange({ clientSecret: event.currentTarget.value })}
          placeholder="Saved secret stays hidden"
          type="password"
          value={form.clientSecret}
        />
      </SettingsRow>
      <SettingsRow controlId="auth-provider-scopes" density="compact" label="Scopes">
        <Input
          className={fieldClassName}
          disabled={disabled}
          id="auth-provider-scopes"
          onChange={(event) => onChange({ scopes: event.currentTarget.value })}
          placeholder="Scopes from your provider"
          value={form.scopes}
        />
      </SettingsRow>
      <SettingsRow controlId="auth-provider-redirect-uris" density="compact" label="Redirect URIs">
        <textarea
          className="min-h-20 w-full min-w-0 rounded-xl border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-96"
          disabled={disabled}
          id="auth-provider-redirect-uris"
          onChange={(event) => onChange({ redirectUris: event.currentTarget.value })}
          placeholder="Redirect URIs registered in your provider"
          value={form.redirectUris}
        />
      </SettingsRow>
    </>
  );
}

function LinkedIdentitiesCard({
  identities,
  isProviderEnabled,
}: {
  identities: readonly AuthIdentity[];
  isProviderEnabled: boolean;
}) {
  function startLinkFlow() {
    window.location.assign("/api/auth/oauth/authentik/start?mode=link&returnTo=/settings/auth");
  }

  return (
    <Card className="shadow-(--shadow-panel)">
      <CardHeader>
        <CardTitle>Linked accounts</CardTitle>
        <CardDescription>Attach your Authentik identity to this admin account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          className="rounded-xl"
          disabled={!isProviderEnabled}
          onClick={startLinkFlow}
          type="button"
          variant="secondary"
        >
          <FingerprintIcon aria-hidden="true" className="size-4" />
          Link Authentik account
        </Button>
        {identities.length > 0 ? (
          <div className="space-y-2">
            {identities.map((identity) => (
              <div
                className="min-w-0 rounded-2xl border border-border bg-card/55 px-3 py-2 text-sm"
                key={identity.id}
              >
                <div className="truncate font-medium text-foreground">{identity.subject}</div>
                <div className="truncate text-xs text-muted-foreground">{identity.issuer}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No linked Authentik identities yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function createFormState(provider: AuthProviderSummary | undefined): AuthProviderFormState {
  return {
    label: provider?.label ?? "Authentik",
    issuer: provider?.issuer ?? "",
    clientId: provider?.clientId ?? "",
    clientSecret: "",
    scopes: provider?.scopes ?? "",
    redirectUris: provider?.redirectUris.join("\n") ?? "",
    enabled: provider?.enabled ?? false,
  };
}

function createProviderRequest(form: AuthProviderFormState): AuthUpsertProviderRequest | null {
  const redirectUris = form.redirectUris
    .split(/\r?\n/u)
    .map((uri) => uri.trim())
    .filter(Boolean);
  const label = form.label.trim();
  const issuer = form.issuer.trim();
  const clientId = form.clientId.trim();
  const scopes = form.scopes.trim();
  const clientSecret = form.clientSecret.trim();

  if (!label || !issuer || !clientId || !scopes || redirectUris.length === 0) {
    return null;
  }

  return {
    label,
    issuer,
    clientId,
    scopes,
    redirectUris,
    enabled: form.enabled,
    ...(clientSecret ? { clientSecret } : {}),
  };
}

function getErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
