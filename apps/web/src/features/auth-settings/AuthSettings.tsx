import {
  AUTH_PROVIDER_SLUGS,
  type AuthIdentity,
  type AuthProviderSummary,
  type AuthUpsertProviderRequest,
} from "@arrtemplar/shared";
import { CaretDownIcon } from "@phosphor-icons/react";
import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SettingsRow, SettingsStatus } from "@/features/settings/SettingsPrimitives";
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
const AUTHENTIK_LOGO_SRC = "/brand/authentik.svg";

export function AuthSettings() {
  const controls = useAuthSettingsController();

  return <AuthMethodGrid controls={controls} />;
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

function AuthMethodGrid({ controls }: { controls: AuthSettingsController }) {
  return (
    <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
      <AuthentikMethodCard controls={controls} />
    </div>
  );
}

function AuthentikMethodCard({ controls }: { controls: AuthSettingsController }) {
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
      title="Authentik"
    >
      <AuthentikAccountLinking
        identities={controls.identities}
        isProviderEnabled={Boolean(controls.provider?.enabled)}
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
          Turn on the provider to edit Authentik OAuth settings.
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
        {controls.isSaving ? "Saving" : "Save Authentik"}
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
        aria-label="Enable Authentik provider"
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

function AuthentikAccountLinking({
  identities,
  isProviderEnabled,
}: {
  identities: readonly AuthIdentity[];
  isProviderEnabled: boolean;
}) {
  const isConnected = identities.length > 0;

  function startLinkFlow() {
    window.location.assign("/api/auth/oauth/authentik/start?mode=link&returnTo=/settings/auth");
  }

  return (
    <section
      aria-label="Authentik account linking"
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium text-foreground">Account linking</h4>
          <LinkedIdentityBadge count={identities.length} />
        </div>
        <p className="text-sm text-muted-foreground">
          {isConnected
            ? "This admin account is connected to Authentik."
            : "Connect this admin account to Authentik."}
        </p>
      </div>
      <Button
        className="w-fit rounded-xl"
        disabled={!isProviderEnabled}
        onClick={startLinkFlow}
        type="button"
        variant="secondary"
      >
        <img alt="" aria-hidden="true" className="size-4 shrink-0" src={AUTHENTIK_LOGO_SRC} />
        Link Authentik account
      </Button>
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
      className={cn(
        "flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-xl text-left transition-colors duration-200",
        "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={onToggle}
      type="button"
    >
      <AuthentikServiceLogo />
      <AuthServiceDetails title={title} />
      <AuthServiceExpandIcon isExpanded={isExpanded} />
    </button>
  );
}

function AuthentikServiceLogo() {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="size-10 shrink-0 object-contain"
      src={AUTHENTIK_LOGO_SRC}
    />
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
