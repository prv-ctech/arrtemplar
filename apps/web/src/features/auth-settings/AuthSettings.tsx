import {
  AUTH_PROVIDER_SLUGS,
  type AuthIdentity,
  type AuthProviderKind,
  type AuthProviderSummary,
  type AuthUpsertProviderRequest,
  OIDC_SIGNING_ALGORITHM_VALUES,
  TOKEN_ENDPOINT_AUTH_METHOD_VALUES,
} from "@arrtemplar/shared";
import { FingerprintIcon } from "@phosphor-icons/react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SettingsStatus } from "@/features/settings/SettingsPrimitives";
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
const AUTH_PROVIDER_EDITABLE_KIND_VALUES = [
  "authentik",
  "authelia",
] as const satisfies readonly AuthProviderKind[];
const providerKindLabels: Record<AuthProviderKind, string> = {
  authentik: "Authentik",
  authelia: "Authelia",
  google: "Google",
  keycloak: "Keycloak",
  okta: "Okta",
  custom: "Custom / generic",
};
const defaultProviderFormState: AuthProviderFormState = {
  providerKind: AUTH_PROVIDER_EDITABLE_KIND_VALUES[0],
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

const compactAuthInputClassName =
  "h-8 w-full rounded-md bg-transparent px-2.5 py-1 text-sm shadow-xs";
const compactAuthActionButtonClassName = "h-7 rounded-md px-2.5 py-1 text-[11px]";

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
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border/80 bg-card/50 p-3">
      <OidcAccountLinking
        identities={controls.identities}
        isProviderEnabled={Boolean(controls.provider?.enabled)}
        onUnlinkAll={controls.handleUnlinkAll}
      />
      <Separator className="my-3" />
      <AuthProviderForm controls={controls} />
    </div>
  );
}

function AuthProviderForm({ controls }: { controls: AuthSettingsController }) {
  return (
    <form className="grid gap-3" onSubmit={controls.handleSubmit}>
      <AuthProviderFields controls={controls} />
      <div className="flex flex-col gap-2 border-t border-border/60 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <SettingsStatus
            errorMessage={controls.errorMessage}
            statusId={controls.statusId}
            statusMessage={controls.statusMessage}
          />
        </div>
        <AuthProviderSaveButton controls={controls} />
      </div>
    </form>
  );
}

function AuthProviderFields({ controls }: { controls: AuthSettingsController }) {
  return (
    <ProviderConfigRows
      disabled={controls.isSaving}
      form={controls.form}
      onChange={controls.updateForm}
    />
  );
}

type OidcSelectItem = { label: string; value: string };

function OidcSelectField({
  ariaLabel,
  className,
  disabled,
  id,
  items,
  onValueChange,
  value,
}: {
  ariaLabel: string;
  className?: string;
  disabled: boolean;
  id: string;
  items: readonly OidcSelectItem[];
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <Select disabled={disabled} onValueChange={onValueChange} value={value}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(compactAuthInputClassName, "justify-between", className)}
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
  return (
    <div className="flex justify-end">
      <Button
        className={compactAuthActionButtonClassName}
        disabled={controls.isSaving}
        size="sm"
        type="submit"
      >
        {controls.isSaving ? "Saving" : "Save"}
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
        "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-card/65 px-2 py-1 text-[11px] font-medium",
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
        size="sm"
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
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <AuthFormField controlId="auth-provider-kind" label="Provider">
        <OidcSelectField
          ariaLabel="OIDC provider kind"
          disabled={disabled}
          id="auth-provider-kind"
          items={AUTH_PROVIDER_EDITABLE_KIND_VALUES.map((value) => ({
            label: providerKindLabels[value],
            value,
          }))}
          onValueChange={(value) => {
            const providerKind = readEditableAuthProviderKind(value);

            if (providerKind) {
              onChange({ providerKind });
            }
          }}
          value={form.providerKind}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-button-text" label="Button text">
        <Input
          className={compactAuthInputClassName}
          disabled={disabled}
          id="auth-provider-button-text"
          onChange={(event) => onChange({ buttonText: event.currentTarget.value })}
          placeholder="Continue with SSO"
          value={form.buttonText}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-issuer" label="Issuer">
        <Input
          className={compactAuthInputClassName}
          disabled={disabled}
          id="auth-provider-issuer"
          onChange={(event) => onChange({ issuer: event.currentTarget.value })}
          placeholder="Issuer URL from your provider"
          value={form.issuer}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-client-id" label="Client ID">
        <Input
          className={compactAuthInputClassName}
          disabled={disabled}
          id="auth-provider-client-id"
          onChange={(event) => onChange({ clientId: event.currentTarget.value })}
          value={form.clientId}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-client-secret" label="Client secret">
        <Input
          autoComplete="off"
          className={compactAuthInputClassName}
          disabled={disabled}
          id="auth-provider-client-secret"
          onChange={(event) => onChange({ clientSecret: event.currentTarget.value })}
          placeholder="Saved secret stays hidden"
          type="password"
          value={form.clientSecret}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-token-auth-method" label="Token auth method">
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
          value={form.tokenEndpointAuthMethod}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-scopes" label="Scopes">
        <Input
          className={compactAuthInputClassName}
          disabled={disabled}
          id="auth-provider-scopes"
          onChange={(event) => onChange({ scopes: event.currentTarget.value })}
          placeholder="Scopes from your provider"
          value={form.scopes}
        />
      </AuthFormField>
      <AuthFormField
        className="sm:col-span-2 lg:col-span-1"
        controlId="auth-provider-redirect-uris"
        label="Redirect URIs"
      >
        <Input
          className={compactAuthInputClassName}
          disabled={disabled}
          id="auth-provider-redirect-uris"
          onChange={(event) => onChange({ redirectUris: event.currentTarget.value })}
          placeholder="Redirect URIs registered in your provider"
          value={form.redirectUris}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-timeout" label="Timeout (ms)">
        <Input
          className={compactAuthInputClassName}
          disabled={disabled}
          id="auth-provider-timeout"
          min={1}
          onChange={(event) => onChange({ timeoutMs: event.currentTarget.value })}
          type="number"
          value={form.timeoutMs}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-prompt" label="Prompt">
        <Input
          className={compactAuthInputClassName}
          disabled={disabled}
          id="auth-provider-prompt"
          onChange={(event) => onChange({ prompt: event.currentTarget.value })}
          placeholder="Optional OIDC prompt"
          value={form.prompt}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-id-token-algorithm" label="ID token algorithm">
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
          value={form.idTokenSigningAlgorithm}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-end-session" label="End session URL">
        <Input
          className={compactAuthInputClassName}
          disabled={disabled}
          id="auth-provider-end-session"
          onChange={(event) => onChange({ endSessionEndpoint: event.currentTarget.value })}
          placeholder="Optional provider logout endpoint"
          value={form.endSessionEndpoint}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-auto-register" label="Auto register">
        <AuthToggleControl
          checked={form.autoRegister}
          disabled={disabled}
          id="auth-provider-auto-register"
          label="Enable automatic OAuth registration"
          onChange={(autoRegister) => onChange({ autoRegister })}
        />
      </AuthFormField>
      <AuthFormField controlId="auth-provider-mobile-redirect" label="Mobile redirect">
        <AuthToggleControl
          checked={form.mobileRedirectEnabled}
          disabled={disabled}
          id="auth-provider-mobile-redirect"
          label="Enable mobile OAuth redirect"
          onChange={(mobileRedirectEnabled) => onChange({ mobileRedirectEnabled })}
        />
      </AuthFormField>
      {form.mobileRedirectEnabled ? (
        <AuthFormField
          controlId="auth-provider-mobile-redirect-uri"
          className="sm:col-span-2 lg:col-span-1"
          label="Mobile redirect URI"
        >
          <Input
            className={compactAuthInputClassName}
            disabled={disabled}
            id="auth-provider-mobile-redirect-uri"
            onChange={(event) => onChange({ mobileRedirectUri: event.currentTarget.value })}
            placeholder="Optional mobile redirect URI"
            value={form.mobileRedirectUri}
          />
        </AuthFormField>
      ) : null}
    </div>
  );
}

function AuthFormField({
  children,
  className,
  controlId,
  label,
}: {
  children: ReactNode;
  className?: string;
  controlId: string;
  label: string;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      <Label className="text-xs font-medium text-muted-foreground" htmlFor={controlId}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function AuthToggleControl({
  checked,
  disabled,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-input px-2.5">
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onChange}
        size="sm"
      />
      <span className="text-sm text-foreground">{checked ? "On" : "Off"}</span>
    </div>
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
  return (
    <section
      aria-label="OAuth account linking"
      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Account linking</h3>
          <LinkedIdentityBadge count={identities.length} />
        </div>
        <LinkedIdentityList identities={identities} onUnlinkAll={onUnlinkAll} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          className={compactAuthActionButtonClassName}
          disabled={!isProviderEnabled}
          onClick={startOidcLinkFlow}
          size="sm"
          type="button"
          variant="secondary"
        >
          Link account
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
    providerKind: normalizeEditableAuthProviderKind(provider.providerKind),
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

function readEditableAuthProviderKind(value: string): AuthProviderKind | null {
  return AUTH_PROVIDER_EDITABLE_KIND_VALUES.find((providerKind) => providerKind === value) ?? null;
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

function normalizeEditableAuthProviderKind(providerKind: AuthProviderKind): AuthProviderKind {
  return readEditableAuthProviderKind(providerKind) ?? AUTH_PROVIDER_EDITABLE_KIND_VALUES[0];
}

function getErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
