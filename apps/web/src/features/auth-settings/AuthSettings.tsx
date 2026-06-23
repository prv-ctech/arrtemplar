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
import { CaretDownIcon } from "@phosphor-icons/react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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

  return <AuthMethodGrid controls={controls} />;
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
  const [isExpanded, setIsExpanded] = useState(true);
  const providerContentId = useId();

  return (
    <AuthServiceCard
      action={
        <ProviderEnabledSwitch
          disabled={controls.isSaving}
          enabled={controls.form.enabled}
          onChange={(enabled) => controls.updateForm({ enabled })}
          statusId={controls.statusId}
        />
      }
      contentId={providerContentId}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded((current) => !current)}
      title="OAuth/OIDC"
    >
      <OidcAccountLinking
        identities={controls.identities}
        isProviderEnabled={Boolean(controls.provider?.enabled)}
        onUnlinkAll={controls.handleUnlinkAll}
      />
      <Separator className="my-3" />
      <AuthProviderForm controls={controls} />
    </AuthServiceCard>
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
    >
      <input
        aria-describedby={statusId}
        aria-label="Enable OIDC provider"
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
  const selectClassName =
    "h-9 rounded-xl border border-input bg-background/50 px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <>
      <SettingsRow controlId="auth-provider-kind" density="compact" label="Provider">
        <select
          className={selectClassName}
          disabled={disabled}
          id="auth-provider-kind"
          onChange={(event) => {
            const providerKind = readAuthProviderKind(event.currentTarget.value);

            if (providerKind) {
              onChange({ providerKind });
            }
          }}
          value={form.providerKind}
        >
          {AUTH_PROVIDER_KIND_VALUES.map((providerKind) => (
            <option key={providerKind} value={providerKind}>
              {providerKindLabels[providerKind]}
            </option>
          ))}
        </select>
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
        <select
          className={selectClassName}
          disabled={disabled}
          id="auth-provider-token-auth-method"
          onChange={(event) => {
            const tokenEndpointAuthMethod = readTokenEndpointAuthMethod(event.currentTarget.value);

            if (tokenEndpointAuthMethod) {
              onChange({ tokenEndpointAuthMethod });
            }
          }}
          value={form.tokenEndpointAuthMethod}
        >
          {TOKEN_ENDPOINT_AUTH_METHOD_VALUES.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
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
          aria-label="Redirect URIs"
          className="min-h-20 w-full min-w-0 rounded-xl border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-96"
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
        <select
          className={selectClassName}
          disabled={disabled}
          id="auth-provider-id-token-algorithm"
          onChange={(event) => {
            const idTokenSigningAlgorithm = readOidcSigningAlgorithm(event.currentTarget.value);

            if (idTokenSigningAlgorithm) {
              onChange({ idTokenSigningAlgorithm });
            }
          }}
          value={form.idTokenSigningAlgorithm}
        >
          {OIDC_SIGNING_ALGORITHM_VALUES.map((algorithm) => (
            <option key={algorithm} value={algorithm}>
              {algorithm}
            </option>
          ))}
        </select>
      </SettingsRow>
      <SettingsRow
        controlId="auth-provider-profile-algorithm"
        density="compact"
        label="Profile algorithm"
      >
        <select
          className={selectClassName}
          disabled={disabled}
          id="auth-provider-profile-algorithm"
          onChange={(event) => {
            const profileSigningAlgorithm = readOidcProfileSigningAlgorithm(
              event.currentTarget.value,
            );

            if (profileSigningAlgorithm) {
              onChange({ profileSigningAlgorithm });
            }
          }}
          value={form.profileSigningAlgorithm}
        >
          {OIDC_PROFILE_SIGNING_ALGORITHM_VALUES.map((algorithm) => (
            <option key={algorithm} value={algorithm}>
              {algorithm}
            </option>
          ))}
        </select>
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

function LinkedIdentityList({ identities }: { identities: readonly AuthIdentity[] }) {
  if (identities.length === 0) {
    return null;
  }

  return (
    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
      {identities.map((identity) => (
        <li
          className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-background/45 px-3 py-2"
          key={identity.id}
        >
          <span className="min-w-0 truncate text-foreground">{identity.displayName}</span>
          <span className="shrink-0 text-xs">{providerKindLabels[identity.providerKind]}</span>
        </li>
      ))}
    </ul>
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
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium text-foreground">Account linking</h4>
          <LinkedIdentityBadge count={identities.length} />
        </div>
        <p className="text-sm text-muted-foreground">
          {isConnected
            ? "This admin account has linked OAuth accounts."
            : "Link this admin account to an OAuth identity."}
        </p>
        <LinkedIdentityList identities={identities} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          className="w-fit rounded-xl"
          disabled={!isProviderEnabled}
          onClick={startOidcLinkFlow}
          type="button"
          variant="secondary"
        >
          Link Accounts
        </Button>
        <Button
          className="rounded-xl"
          disabled={!isConnected}
          onClick={onUnlinkAll}
          type="button"
          variant="destructive"
        >
          Unlink all
        </Button>
      </div>
    </section>
  );
}

function AuthServiceCard({
  action,
  children,
  contentId,
  isExpanded,
  onToggle,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  contentId: string;
  isExpanded: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <Card className="w-full overflow-hidden rounded-2xl bg-card/50 shadow-none">
      <AuthServiceCardHeader
        action={action}
        contentId={contentId}
        isExpanded={isExpanded}
        onToggle={onToggle}
        title={title}
      />
      <AuthServiceCardBody contentId={contentId} isExpanded={isExpanded}>
        {children}
      </AuthServiceCardBody>
    </Card>
  );
}

function AuthServiceCardHeader({
  action,
  contentId,
  isExpanded,
  onToggle,
  title,
}: {
  action?: ReactNode;
  contentId: string;
  isExpanded: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <CardHeader className="p-0">
      <div className="flex items-start gap-2 p-3">
        <AuthServiceToggleButton
          contentId={contentId}
          isExpanded={isExpanded}
          onToggle={onToggle}
          title={title}
        />
        {action}
      </div>
    </CardHeader>
  );
}

function AuthServiceToggleButton({
  contentId,
  isExpanded,
  onToggle,
  title,
}: {
  contentId: string;
  isExpanded: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <button
      aria-controls={contentId}
      aria-expanded={isExpanded}
      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${title} auth settings`}
      className={cn(
        "flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-xl text-left transition-colors duration-200",
        "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={onToggle}
      type="button"
    >
      <OidcServiceLogo />
      <AuthServiceDetails title={title} />
      <AuthServiceExpandIcon isExpanded={isExpanded} />
    </button>
  );
}

function startOidcLinkFlow() {
  window.location.assign("/api/auth/oauth/oidc/start?mode=link&returnTo=/settings/auth");
}

function OidcServiceLogo() {
  return (
    <div
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-xs font-black tracking-[-0.08em] text-secondary-foreground"
    >
      ID
    </div>
  );
}

function AuthServiceDetails({ title }: { title: string }) {
  return (
    <div className="min-w-0 flex-1 py-2.5">
      <CardTitle className="text-sm leading-5 sm:text-base">{title}</CardTitle>
    </div>
  );
}

function AuthServiceExpandIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <CaretDownIcon
      aria-hidden="true"
      className={cn(
        "mt-3 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
        isExpanded && "rotate-180",
      )}
    />
  );
}

function AuthServiceCardBody({
  children,
  contentId,
  isExpanded,
}: {
  children: ReactNode;
  contentId: string;
  isExpanded: boolean;
}) {
  if (!isExpanded) {
    return null;
  }

  return (
    <>
      <Separator />
      <CardContent className="p-2.5" id={contentId}>
        {children}
      </CardContent>
    </>
  );
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
    redirectUris: provider.redirectUris.join("\n"),
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
  const redirectUris = form.redirectUris.split(/\r?\n/u).flatMap((uri) => {
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
