import {
  AUTH_PROVIDER_KIND_VALUES,
  AUTH_PROVIDER_SLUGS,
  type AuthIdentity,
  type AuthProviderKind,
  type AuthProviderSummary,
  type AuthUpsertProviderRequest,
  OIDC_PROFILE_SIGNING_ALGORITHM_VALUES,
  OIDC_SIGNING_ALGORITHM_VALUES,
  TOKEN_ENDPOINT_AUTH_METHOD_VALUES,
} from "@arrtemplar/shared";
import { FingerprintIcon } from "@phosphor-icons/react";
import { type FormEvent, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notify } from "@/features/notifications/notification-gateway";
import { SettingsRow, SettingsStatus } from "@/features/settings/SettingsPrimitives";
import { cn } from "@/lib/utils";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import {
  useAuthIdentitiesQuery,
  useAuthProvidersQuery,
  useUnlinkAllAuthIdentitiesMutation,
  useUpsertAuthProviderMutation,
} from "./auth-settings";

type AuthProviderFormState = {
  providerKind: AuthProviderKind;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  redirectUris: string;
  enabled: boolean;
  buttonText: string;
  autoRegister: boolean;
  tokenEndpointAuthMethod: AuthProviderSummary["tokenEndpointAuthMethod"];
  timeoutMs: string;
  prompt: string;
  endSessionEndpoint: string;
  idTokenSigningAlgorithm: AuthProviderSummary["idTokenSigningAlgorithm"];
  profileSigningAlgorithm: AuthProviderSummary["profileSigningAlgorithm"];
  mobileRedirectEnabled: boolean;
  mobileRedirectUri: string;
};

const authProviderSlug = AUTH_PROVIDER_SLUGS[0];
const providerKindLabels: Record<AuthProviderKind, string> = {
  authentik: "Authentik",
  authelia: "Authelia",
  google: "Google",
  keycloak: "Keycloak",
  okta: "Okta",
  custom: "Custom / generic",
};
const defaultProviderFormState: AuthProviderFormState = {
  providerKind: "custom",
  label: "OIDC",
  issuer: "",
  clientId: "",
  clientSecret: "",
  scopes: "",
  redirectUris: "",
  enabled: false,
  buttonText: "Continue with SSO",
  autoRegister: true,
  tokenEndpointAuthMethod: "client_secret_basic",
  timeoutMs: "10000",
  prompt: "",
  endSessionEndpoint: "",
  idTokenSigningAlgorithm: "RS256",
  profileSigningAlgorithm: "none",
  mobileRedirectEnabled: false,
  mobileRedirectUri: "",
};

export function AuthSettings() {
  const providersQuery = useAuthProvidersQuery();
  const identitiesQuery = useAuthIdentitiesQuery();
  const provider = providersQuery.data?.find((candidate) => candidate.slug === authProviderSlug);

  return (
    <AuthSettingsFormController
      identities={identitiesQuery.data ?? []}
      key={createProviderFormKey(provider)}
      provider={provider}
      providerError={providersQuery.error}
    />
  );
}

function AuthSettingsFormController({
  identities,
  provider,
  providerError,
}: {
  identities: readonly AuthIdentity[];
  provider: AuthProviderSummary | undefined;
  providerError: unknown;
}) {
  const controls = useAuthSettingsController({ identities, provider, providerError });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-secondary text-secondary-foreground">
            <FingerprintIcon aria-hidden="true" className="size-4" />
          </span>
          <h2 className="text-base font-semibold leading-5 tracking-tight">OAuth/OIDC</h2>
        </div>
        <ProviderEnabledSwitch
          disabled={controls.isSaving}
          enabled={controls.form.enabled}
          onChange={(enabled) => controls.updateForm({ enabled })}
          statusId={controls.statusId}
        />
      </div>
      <AuthMethodGrid controls={controls} />
    </section>
  );
}

function useAuthSettingsController({
  identities,
  provider,
  providerError,
}: {
  identities: readonly AuthIdentity[];
  provider: AuthProviderSummary | undefined;
  providerError: unknown;
}) {
  const actor = useAuthenticatedRouteUser();
  const [form, setForm] = useState(() => createFormState(provider));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const saveMutation = useUpsertAuthProviderMutation();
  const unlinkAllMutation = useUnlinkAllAuthIdentitiesMutation();
  const statusId = useId();
  const isSaving = saveMutation.isPending || unlinkAllMutation.isPending;
  const errorMessage =
    formError ?? getErrorMessage(providerError ?? saveMutation.error ?? unlinkAllMutation.error);

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
      setFormError("Complete provider kind, issuer, client ID, scopes, and redirect URI.");
      return;
    }

    if (
      request.tokenEndpointAuthMethod !== "none" &&
      !provider?.hasClientSecret &&
      !request.clientSecret
    ) {
      setFormError("Enter the OIDC client secret before saving.");
      return;
    }

    saveMutation.mutate(
      { slug: authProviderSlug, input: request },
      {
        onSuccess: () => {
          setForm((current) => ({ ...current, clientSecret: "" }));
          setStatusMessage("OIDC provider saved.");
          notify(
            {
              id: "auth.provider.saved",
              title: "OAuth settings saved.",
            },
            actor.notificationPreferences,
          );
        },
        onError: (error) => {
          notify(
            {
              id: "auth.provider.save.failed",
              title: error instanceof Error ? error.message : "OAuth settings save failed.",
            },
            actor.notificationPreferences,
          );
        },
      },
    );
  }

  function handleUnlinkAll() {
    setFormError(null);
    setStatusMessage(null);

    const confirmed = window.confirm(
      "Unlink all OAuth accounts? Users stay in Arrtemplar, but OAuth links and OAuth sessions are removed.",
    );

    if (!confirmed) {
      return;
    }

    unlinkAllMutation.mutate(undefined, {
      onSuccess: ({ deletedIdentityCount, revokedOAuthSessionCount }) => {
        setStatusMessage(
          `Unlinked ${deletedIdentityCount} OAuth account${deletedIdentityCount === 1 ? "" : "s"} and revoked ${revokedOAuthSessionCount} OAuth session${revokedOAuthSessionCount === 1 ? "" : "s"}.`,
        );
      },
    });
  }

  return {
    errorMessage,
    form,
    handleSubmit,
    handleUnlinkAll,
    identities,
    isSaving,
    provider,
    statusId,
    statusMessage: isSaving ? "Saving OAuth settings" : statusMessage,
    updateForm,
  };
}

type AuthSettingsController = ReturnType<typeof useAuthSettingsController>;

function AuthMethodGrid({ controls }: { controls: AuthSettingsController }) {
  return (
    <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
      <OidcMethodCard controls={controls} />
    </div>
  );
}

function OidcMethodCard({ controls }: { controls: AuthSettingsController }) {
  return (
    <Card className="w-full min-w-0 overflow-hidden rounded-2xl bg-card/50 shadow-none">
      <CardContent className="p-3 sm:p-4">
        <OidcAccountLinking
          identities={controls.identities}
          isProviderEnabled={Boolean(controls.provider?.enabled)}
          onUnlinkAll={controls.handleUnlinkAll}
        />
        <Separator className="my-3" />
        <AuthProviderForm controls={controls} />
      </CardContent>
    </Card>
  );
}

function AuthProviderForm({ controls }: { controls: AuthSettingsController }) {
  return (
    <form className="space-y-3" onSubmit={controls.handleSubmit}>
      <AuthProviderFields controls={controls} />
      <SettingsStatus
        errorMessage={controls.errorMessage}
        statusId={controls.statusId}
        statusMessage={controls.statusMessage}
      />
      <AuthProviderSaveButton controls={controls} />
    </form>
  );
}

function AuthProviderFields({ controls }: { controls: AuthSettingsController }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/50">
      {controls.form.enabled ? (
        <ProviderConfigRows
          disabled={controls.isSaving}
          form={controls.form}
          onChange={controls.updateForm}
        />
      ) : (
        <p className="px-3 py-2.5 text-sm text-muted-foreground sm:px-4">
          Turn on the provider to edit OAuth/OIDC settings.
        </p>
      )}
    </div>
  );
}

type OidcSelectItem = { label: string; value: string };

function OidcSelectField({
  ariaLabel,
  disabled,
  id,
  items,
  onValueChange,
  triggerClassName,
  value,
}: {
  ariaLabel: string;
  disabled: boolean;
  id: string;
  items: readonly OidcSelectItem[];
  onValueChange: (value: string) => void;
  triggerClassName: string;
  value: string;
}) {
  return (
    <Select disabled={disabled} onValueChange={onValueChange} value={value}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("h-9 rounded-xl", triggerClassName)}
        id={id}
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AuthProviderSaveButton({ controls }: { controls: AuthSettingsController }) {
  if (!controls.form.enabled && !controls.provider) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <Button className="rounded-xl" disabled={controls.isSaving} size="sm" type="submit">
        {controls.isSaving ? "Saving" : "Save OAuth"}
      </Button>
    </div>
  );
}

function ProviderEnabledSwitch({
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
    <label
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card/65 px-2.5 py-1.5 text-xs font-medium",
        disabled && "cursor-not-allowed opacity-60",
      )}
      htmlFor="auth-provider-enabled"
    >
      <Switch
        aria-describedby={statusId}
        aria-label="Enable OIDC provider"
        checked={enabled}
        disabled={disabled}
        id="auth-provider-enabled"
        onCheckedChange={onChange}
      />
      <span className="text-foreground">{enabled ? "On" : "Off"}</span>
    </label>
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
      <SettingsRow controlId="auth-provider-kind" density="compact" label="Provider">
        <OidcSelectField
          ariaLabel="OIDC provider kind"
          disabled={disabled}
          id="auth-provider-kind"
          items={AUTH_PROVIDER_KIND_VALUES.map((value) => ({
            label: providerKindLabels[value],
            value,
          }))}
          onValueChange={(value) => {
            const providerKind = readAuthProviderKind(value);

            if (providerKind) {
              onChange({ providerKind });
            }
          }}
          triggerClassName="w-full sm:w-56"
          value={form.providerKind}
        />
      </SettingsRow>
      <SettingsRow controlId="auth-provider-button-text" density="compact" label="Button text">
        <Input
          className={fieldClassName}
          disabled={disabled}
          id="auth-provider-button-text"
          onChange={(event) => onChange({ buttonText: event.currentTarget.value })}
          placeholder="Continue with SSO"
          value={form.buttonText}
        />
      </SettingsRow>
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
      <SettingsRow
        controlId="auth-provider-token-auth-method"
        density="compact"
        label="Token auth method"
      >
        <OidcSelectField
          ariaLabel="OIDC token auth method"
          disabled={disabled}
          id="auth-provider-token-auth-method"
          items={TOKEN_ENDPOINT_AUTH_METHOD_VALUES.map((value) => ({ label: value, value }))}
          onValueChange={(value) => {
            const tokenEndpointAuthMethod = readTokenEndpointAuthMethod(value);

            if (tokenEndpointAuthMethod) {
              onChange({ tokenEndpointAuthMethod });
            }
          }}
          triggerClassName="w-full sm:w-56"
          value={form.tokenEndpointAuthMethod}
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
        <Input
          className={fieldClassName}
          disabled={disabled}
          id="auth-provider-redirect-uris"
          onChange={(event) => onChange({ redirectUris: event.currentTarget.value })}
          placeholder="Redirect URIs registered in your provider"
          value={form.redirectUris}
        />
      </SettingsRow>
      <SettingsRow controlId="auth-provider-timeout" density="compact" label="Timeout (ms)">
        <Input
          className={fieldClassName}
          disabled={disabled}
          id="auth-provider-timeout"
          min={1}
          onChange={(event) => onChange({ timeoutMs: event.currentTarget.value })}
          type="number"
          value={form.timeoutMs}
        />
      </SettingsRow>
      <SettingsRow controlId="auth-provider-prompt" density="compact" label="Prompt">
        <Input
          className={fieldClassName}
          disabled={disabled}
          id="auth-provider-prompt"
          onChange={(event) => onChange({ prompt: event.currentTarget.value })}
          placeholder="Optional OIDC prompt"
          value={form.prompt}
        />
      </SettingsRow>
      <SettingsRow
        controlId="auth-provider-id-token-algorithm"
        density="compact"
        label="ID token algorithm"
      >
        <OidcSelectField
          ariaLabel="OIDC ID token signing algorithm"
          disabled={disabled}
          id="auth-provider-id-token-algorithm"
          items={OIDC_SIGNING_ALGORITHM_VALUES.map((value) => ({ label: value, value }))}
          onValueChange={(value) => {
            const idTokenSigningAlgorithm = readOidcSigningAlgorithm(value);

            if (idTokenSigningAlgorithm) {
              onChange({ idTokenSigningAlgorithm });
            }
          }}
          triggerClassName="w-full sm:w-44"
          value={form.idTokenSigningAlgorithm}
        />
      </SettingsRow>
      <SettingsRow
        controlId="auth-provider-profile-algorithm"
        density="compact"
        label="Profile algorithm"
      >
        <OidcSelectField
          ariaLabel="OIDC profile signing algorithm"
          disabled={disabled}
          id="auth-provider-profile-algorithm"
          items={OIDC_PROFILE_SIGNING_ALGORITHM_VALUES.map((value) => ({ label: value, value }))}
          onValueChange={(value) => {
            const profileSigningAlgorithm = readOidcProfileSigningAlgorithm(value);

            if (profileSigningAlgorithm) {
              onChange({ profileSigningAlgorithm });
            }
          }}
          triggerClassName="w-full sm:w-44"
          value={form.profileSigningAlgorithm}
        />
      </SettingsRow>
      <SettingsRow controlId="auth-provider-end-session" density="compact" label="End session URL">
        <Input
          className={fieldClassName}
          disabled={disabled}
          id="auth-provider-end-session"
          onChange={(event) => onChange({ endSessionEndpoint: event.currentTarget.value })}
          placeholder="Optional provider logout endpoint"
          value={form.endSessionEndpoint}
        />
      </SettingsRow>
      <SettingsRow controlId="auth-provider-auto-register" density="compact" label="Auto register">
        <input
          aria-label="Enable automatic OAuth registration"
          checked={form.autoRegister}
          className="size-4 rounded border-border accent-primary"
          disabled={disabled}
          id="auth-provider-auto-register"
          onChange={(event) => onChange({ autoRegister: event.currentTarget.checked })}
          type="checkbox"
        />
      </SettingsRow>
      <SettingsRow
        controlId="auth-provider-mobile-redirect"
        density="compact"
        label="Mobile redirect"
      >
        <input
          aria-label="Enable mobile OAuth redirect"
          checked={form.mobileRedirectEnabled}
          className="size-4 rounded border-border accent-primary"
          disabled={disabled}
          id="auth-provider-mobile-redirect"
          onChange={(event) => onChange({ mobileRedirectEnabled: event.currentTarget.checked })}
          type="checkbox"
        />
      </SettingsRow>
      {form.mobileRedirectEnabled ? (
        <SettingsRow
          controlId="auth-provider-mobile-redirect-uri"
          density="compact"
          label="Mobile redirect URI"
        >
          <Input
            className={fieldClassName}
            disabled={disabled}
            id="auth-provider-mobile-redirect-uri"
            onChange={(event) => onChange({ mobileRedirectUri: event.currentTarget.value })}
            placeholder="Optional mobile redirect URI"
            value={form.mobileRedirectUri}
          />
        </SettingsRow>
      ) : null}
    </>
  );
}

function LinkedIdentityList({
  identities,
  onUnlinkAll,
}: {
  identities: readonly AuthIdentity[];
  onUnlinkAll: () => void;
}) {
  if (identities.length === 0) {
    return null;
  }

  return (
    <Table
      className="mt-3"
      containerClassName="rounded-lg border border-border/80 bg-background/40"
    >
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-8 px-3 text-xs">Identity</TableHead>
          <TableHead className="h-8 px-3 text-xs">Provider</TableHead>
          <TableHead className="h-8 px-3 text-right text-xs">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {identities.map((identity) => (
          <TableRow key={identity.id}>
            <TableCell className="px-3 py-2 text-sm text-foreground">
              <span className="block truncate">{identity.displayName}</span>
              <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                {identity.subjectPreview}
              </span>
            </TableCell>
            <TableCell className="px-3 py-2 text-sm text-muted-foreground">
              {providerKindLabels[identity.providerKind]}
            </TableCell>
            <TableCell className="px-3 py-2 text-right">
              <Button
                className="h-7 rounded-md px-2 text-xs"
                disabled={identities.length === 0}
                onClick={onUnlinkAll}
                size="sm"
                type="button"
                variant="ghost"
              >
                Unlink all
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OidcAccountLinking({
  identities,
  isProviderEnabled,
  onUnlinkAll,
}: {
  identities: readonly AuthIdentity[];
  isProviderEnabled: boolean;
  onUnlinkAll: () => void;
}) {
  const isConnected = identities.length > 0;

  return (
    <section
      aria-label="OAuth account linking"
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium text-foreground">Account linking</h4>
          <LinkedIdentityBadge count={identities.length} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isConnected
            ? "This admin account has linked OAuth accounts."
            : "Link this admin account to an OAuth identity."}
        </p>
        <LinkedIdentityList identities={identities} onUnlinkAll={onUnlinkAll} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          className="h-8 rounded-lg px-2.5 text-xs"
          disabled={!isProviderEnabled}
          onClick={startOidcLinkFlow}
          size="sm"
          type="button"
          variant="secondary"
        >
          Link Accounts
        </Button>
      </div>
    </section>
  );
}

function startOidcLinkFlow() {
  window.location.assign("/api/auth/oauth/oidc/start?mode=link&returnTo=/settings/auth");
}

function LinkedIdentityBadge({ count }: { count: number }) {
  return (
    <Badge variant={count > 0 ? "default" : "secondary"}>
      {count > 0 ? "Connected" : "Not linked"}
    </Badge>
  );
}

function createFormState(provider: AuthProviderSummary | undefined): AuthProviderFormState {
  if (!provider) {
    return defaultProviderFormState;
  }

  return {
    providerKind: provider.providerKind,
    label: provider.label,
    issuer: provider.issuer,
    clientId: provider.clientId,
    clientSecret: "",
    scopes: provider.scopes,
    redirectUris: provider.redirectUris.join(" "),
    enabled: provider.enabled,
    buttonText: provider.buttonText,
    autoRegister: provider.autoRegister,
    tokenEndpointAuthMethod: provider.tokenEndpointAuthMethod,
    timeoutMs: String(provider.timeoutMs),
    prompt: provider.prompt ?? "",
    endSessionEndpoint: provider.endSessionEndpoint ?? "",
    idTokenSigningAlgorithm: provider.idTokenSigningAlgorithm,
    profileSigningAlgorithm: provider.profileSigningAlgorithm,
    mobileRedirectEnabled: provider.mobileRedirectEnabled,
    mobileRedirectUri: provider.mobileRedirectUri ?? "",
  };
}

function createProviderFormKey(provider: AuthProviderSummary | undefined): string {
  return provider ? `${provider.slug}:${provider.updatedAt}` : `${authProviderSlug}:new`;
}

function createProviderRequest(form: AuthProviderFormState): AuthUpsertProviderRequest | null {
  const redirectUris = form.redirectUris.split(/\s+/u).flatMap((uri) => {
    const trimmedUri = uri.trim();
    return trimmedUri ? [trimmedUri] : [];
  });
  const label = form.label.trim();
  const issuer = form.issuer.trim();
  const clientId = form.clientId.trim();
  const scopes = form.scopes.trim();
  const clientSecret = form.clientSecret.trim();
  const buttonText = form.buttonText.trim();
  const timeoutMs = Number.parseInt(form.timeoutMs, 10);
  const prompt = form.prompt.trim();
  const endSessionEndpoint = form.endSessionEndpoint.trim();
  const mobileRedirectUri = form.mobileRedirectUri.trim();

  if (!label || !issuer || !clientId || !scopes || !buttonText || redirectUris.length === 0) {
    return null;
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    return null;
  }

  return {
    providerKind: form.providerKind,
    label,
    issuer,
    clientId,
    scopes,
    redirectUris,
    enabled: form.enabled,
    buttonText,
    autoRegister: form.autoRegister,
    tokenEndpointAuthMethod: form.tokenEndpointAuthMethod,
    timeoutMs,
    ...(prompt ? { prompt } : { prompt: null }),
    ...(endSessionEndpoint ? { endSessionEndpoint } : { endSessionEndpoint: null }),
    idTokenSigningAlgorithm: form.idTokenSigningAlgorithm,
    profileSigningAlgorithm: form.profileSigningAlgorithm,
    mobileRedirectEnabled: form.mobileRedirectEnabled,
    ...(mobileRedirectUri ? { mobileRedirectUri } : { mobileRedirectUri: null }),
    ...(clientSecret ? { clientSecret } : {}),
  };
}

function readAuthProviderKind(value: string): AuthProviderKind | null {
  return AUTH_PROVIDER_KIND_VALUES.find((providerKind) => providerKind === value) ?? null;
}

function readTokenEndpointAuthMethod(
  value: string,
): AuthProviderSummary["tokenEndpointAuthMethod"] | null {
  return TOKEN_ENDPOINT_AUTH_METHOD_VALUES.find((method) => method === value) ?? null;
}

function readOidcSigningAlgorithm(
  value: string,
): AuthProviderSummary["idTokenSigningAlgorithm"] | null {
  return OIDC_SIGNING_ALGORITHM_VALUES.find((algorithm) => algorithm === value) ?? null;
}

function readOidcProfileSigningAlgorithm(
  value: string,
): AuthProviderSummary["profileSigningAlgorithm"] | null {
  return OIDC_PROFILE_SIGNING_ALGORITHM_VALUES.find((algorithm) => algorithm === value) ?? null;
}

function getErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
