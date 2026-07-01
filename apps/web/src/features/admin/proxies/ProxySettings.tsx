import type {
  ProxyProfileKind,
  ProxyProfileSummary,
  UpsertProxyProfileRequest,
} from "@arrtemplar/shared";
import { ShieldCheckIcon } from "@phosphor-icons/react";
import { type FormEvent, Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import { notify } from "@/features/notifications/notification-gateway";
import { SettingsStatus } from "@/features/settings/SettingsPrimitives";
import { ApiClientError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { AdminDesktopTable, ExpandableTableTitleButton } from "../admin-table-primitives";
import {
  useDeleteProxyProfileMutation,
  useProxyProfilesQuery,
  useSaveProxyProfileMutation,
  useTestProxyProfileMutation,
} from "./proxy-settings";

type ProxySettingsState = ReturnType<typeof useProxySettingsState>;

type ProxyRowDefinition = {
  defaultName: string;
  defaultPath?: string;
  defaultPort?: string;
  description: string;
  kind: ProxyProfileKind;
  logoPath: string;
  title: string;
};

type ProxyProfileFormState = {
  clearPassword: boolean;
  enabled: boolean;
  host: string;
  name: string;
  password: string;
  path: string;
  port: string;
  requestTimeoutMs: string;
  scheme: "http" | "https";
  sessionName: string;
  sessionTtlMinutes: string;
  username: string;
  variant: "byparr" | "flaresolverr" | "trawl";
};

type StatusBadge = {
  className?: string;
  label: string;
  variant: "destructive" | "outline" | "secondary" | "success";
};

const proxyRows: readonly ProxyRowDefinition[] = [
  {
    kind: "challenge_solver",
    title: "Challenge solver",
    defaultName: "Challenge solver",
    defaultPort: "8191",
    defaultPath: "/v1",
    description: "Bypass challenges from Cloudflare and others.",
    logoPath: "/services/flaresolverr.svg",
  },
  {
    kind: "http_proxy",
    title: "HTTP(S) proxy",
    defaultName: "HTTP proxy",
    description: "HTTP(S) proxy.",
    logoPath: "/services/http.svg",
  },
] as const;

const proxyTableColumns = [
  { label: "Name" },
  { label: "Type" },
  { label: "Last test" },
  { label: "Status" },
] as const;

const PROXY_DESKTOP_COLUMN_COUNT = proxyTableColumns.length;
const compactProxyInputClassName =
  "h-8 rounded-md border-border/85 bg-background/72 px-2.5 py-1 text-sm shadow-xs";
const proxyInlineActionButtonClassName = "h-7 rounded-md px-2.5 py-1 text-[11px]";

export function ProxySettings() {
  return <ProxySettingsView state={useProxySettingsState()} />;
}

function useProxySettingsState() {
  const actor = useAuthenticatedRouteUser();
  const profilesQuery = useProxyProfilesQuery();
  const saveMutation = useSaveProxyProfileMutation();
  const deleteMutation = useDeleteProxyProfileMutation();
  const testMutation = useTestProxyProfileMutation();
  const [expandedKind, setExpandedKind] = useState<ProxyProfileKind | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProxyProfileSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const profilesByKind = useMemo(
    () => new Map((profilesQuery.data ?? []).map((profile) => [profile.kind, profile] as const)),
    [profilesQuery.data],
  );

  function toggleExpandedKind(kind: ProxyProfileKind) {
    setErrorMessage(null);
    setStatusMessage(null);
    setExpandedKind((current) => (current === kind ? null : kind));
  }

  function saveProfile(profile: ProxyProfileSummary | undefined, input: UpsertProxyProfileRequest) {
    setErrorMessage(null);
    saveMutation.mutate(
      { profile, input },
      {
        onSuccess: (savedProfile) => {
          setStatusMessage("Proxy settings saved.");
          notify(
            {
              id: "services.saved",
              title: "Proxy settings saved.",
              description: savedProfile.name,
            },
            actor.notificationPreferences,
          );
        },
        onError: (error) => {
          const message = readMutationErrorMessage(error, "Proxy settings save failed.");

          setErrorMessage(message);
          notify(
            {
              id: "services.save.failed",
              title: message,
              description: profile?.name ?? input.name,
            },
            actor.notificationPreferences,
          );
        },
      },
    );
  }

  function clearProfile(profile: ProxyProfileSummary) {
    setErrorMessage(null);
    deleteMutation.mutate(profile.id, {
      onSuccess: () => {
        setPendingDelete(null);
        setStatusMessage("Proxy cleared.");
        notify(
          {
            id: "services.deleted",
            title: "Proxy cleared.",
            description: profile.name,
          },
          actor.notificationPreferences,
        );
      },
      onError: (error) => {
        const message = readMutationErrorMessage(error, "Proxy clear failed.");

        setErrorMessage(message);
        notify(
          {
            id: "services.delete.failed",
            title: message,
            description: profile.name,
          },
          actor.notificationPreferences,
        );
      },
    });
  }

  function testProfile(profile: ProxyProfileSummary) {
    setErrorMessage(null);
    testMutation.mutate(profile.id, {
      onSuccess: (result) => {
        setStatusMessage(result.result.message);
        if (result.result.outcome === "failed") {
          setErrorMessage(result.result.message);
        }
        notify(
          {
            id: result.result.outcome === "success" ? "services.tested" : "services.test.failed",
            title:
              result.result.outcome === "success" ? "Proxy test passed." : result.result.message,
            description: profile.name,
          },
          actor.notificationPreferences,
        );
      },
      onError: (error) => {
        const message = readMutationErrorMessage(error, "Proxy test failed.");

        setErrorMessage(message);
        notify(
          {
            id: "services.test.failed",
            title: message,
            description: profile.name,
          },
          actor.notificationPreferences,
        );
      },
    });
  }

  return {
    deleteMutation,
    errorMessage,
    expandedKind,
    pendingDelete,
    profilesByKind,
    profilesQuery,
    saveMutation,
    setPendingDelete,
    statusMessage,
    testMutation,
    clearProfile,
    saveProfile,
    testProfile,
    toggleExpandedKind,
  };
}

function ProxySettingsView({ state }: { state: ProxySettingsState }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-secondary text-secondary-foreground">
          <ShieldCheckIcon aria-hidden="true" className="size-4" />
        </span>
        <h2 className="text-base font-semibold leading-5 tracking-tight">Proxies</h2>
      </div>

      <SettingsStatus
        errorMessage={state.errorMessage}
        statusId="proxy-settings-status"
        statusMessage={state.statusMessage}
      />

      <ProxyProfilesContent state={state} />

      <ClearProxyProfileDialog
        deleting={state.deleteMutation.isPending}
        onClose={() => state.setPendingDelete(null)}
        onConfirm={() => state.pendingDelete && state.clearProfile(state.pendingDelete)}
        profile={state.pendingDelete}
      />
    </section>
  );
}

function ProxyProfilesContent({ state }: { state: ProxySettingsState }) {
  if (state.profilesQuery.isLoading) {
    return <ProxySettingsSkeleton />;
  }

  if (state.profilesQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/35 bg-destructive/5 p-3 text-sm font-medium text-destructive">
        Proxy settings failed to load.
      </div>
    );
  }

  return (
    <>
      <AdminDesktopTable columns={proxyTableColumns}>
        {proxyRows.map((row) => {
          const profile = state.profilesByKind.get(row.kind);
          const isExpanded = state.expandedKind === row.kind;

          return (
            <Fragment key={row.kind}>
              <TableRow
                className="cursor-pointer"
                data-state={isExpanded ? "selected" : undefined}
                onClick={() => state.toggleExpandedKind(row.kind)}
              >
                <TableCell className="px-3 py-2">
                  <ProxyTitleButton
                    expanded={isExpanded}
                    onToggle={() => state.toggleExpandedKind(row.kind)}
                    profile={profile}
                    row={row}
                  />
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                  {row.title}
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                  {formatDate(profile?.lastTestedAt ?? null)}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <ProxyStatusBadge profile={profile} />
                </TableCell>
              </TableRow>
              {isExpanded ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    className="bg-background/35 px-3 py-3"
                    colSpan={PROXY_DESKTOP_COLUMN_COUNT}
                  >
                    <ProxyProfileInlineForm
                      errorMessage={state.errorMessage}
                      idPrefix={`desktop-${row.kind}`}
                      key={`${row.kind}:${profile?.updatedAt ?? "new"}`}
                      onClear={() => profile && state.setPendingDelete(profile)}
                      onSubmit={(input) => state.saveProfile(profile, input)}
                      onTest={() => profile && state.testProfile(profile)}
                      profile={profile}
                      row={row}
                      saving={state.saveMutation.isPending}
                      testing={state.testMutation.isPending}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </AdminDesktopTable>

      <div className="grid gap-2 md:hidden">
        {proxyRows.map((row) => {
          const profile = state.profilesByKind.get(row.kind);

          return (
            <ProxyMobileCard
              expanded={state.expandedKind === row.kind}
              key={row.kind}
              profile={profile}
              row={row}
              onClear={() => profile && state.setPendingDelete(profile)}
              onSave={(input) => state.saveProfile(profile, input)}
              onTest={() => profile && state.testProfile(profile)}
              onToggle={() => state.toggleExpandedKind(row.kind)}
              saving={state.saveMutation.isPending}
              testing={state.testMutation.isPending}
            />
          );
        })}
      </div>
    </>
  );
}

function ProxySettingsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-10 rounded-lg" />
    </div>
  );
}

function ProxyTitleButton({
  expanded,
  onToggle,
  profile,
  row,
}: {
  expanded: boolean;
  onToggle: () => void;
  profile: ProxyProfileSummary | undefined;
  row: ProxyRowDefinition;
}) {
  return (
    <ExpandableTableTitleButton expanded={expanded} onToggle={onToggle}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-secondary/35">
        <img alt="" className="h-4 w-auto" src={row.logoPath} />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {profile?.name ?? row.defaultName}
        </span>
        <span className="truncate text-xs text-muted-foreground">{row.description}</span>
      </span>
    </ExpandableTableTitleButton>
  );
}

function ProxyStatusBadge({ profile }: { profile: ProxyProfileSummary | undefined }) {
  const badge = readStatusBadge(profile);

  return (
    <Badge className={badge.className} variant={badge.variant}>
      {badge.label}
    </Badge>
  );
}

function ProxyMobileCard({
  expanded,
  profile,
  row,
  onClear,
  onSave,
  onTest,
  onToggle,
  saving,
  testing,
}: {
  expanded: boolean;
  profile: ProxyProfileSummary | undefined;
  row: ProxyRowDefinition;
  onClear: () => void;
  onSave: (input: UpsertProxyProfileRequest) => void;
  onTest: () => void;
  onToggle: () => void;
  saving: boolean;
  testing: boolean;
}) {
  return (
    <article className="rounded-lg border border-border/80 bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <ProxyTitleButton expanded={expanded} onToggle={onToggle} profile={profile} row={row} />
        <ProxyStatusBadge profile={profile} />
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        <ProxyMobileDetail label="Type" value={row.title} />
        <ProxyMobileDetail label="Last test" value={formatDate(profile?.lastTestedAt ?? null)} />
      </dl>
      {expanded ? (
        <div className="mt-3 border-t border-border pt-3">
          <ProxyProfileInlineForm
            errorMessage={null}
            idPrefix={`mobile-${row.kind}`}
            key={`${row.kind}:${profile?.updatedAt ?? "new"}`}
            onClear={onClear}
            onSubmit={onSave}
            onTest={onTest}
            profile={profile}
            row={row}
            saving={saving}
            testing={testing}
          />
        </div>
      ) : null}
    </article>
  );
}

function ProxyMobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-foreground">{value}</dd>
    </div>
  );
}

function ProxyProfileInlineForm({
  errorMessage,
  idPrefix,
  onClear,
  onSubmit,
  onTest,
  profile,
  row,
  saving,
  testing,
}: {
  errorMessage: string | null;
  idPrefix: string;
  onClear: () => void;
  onSubmit: (input: UpsertProxyProfileRequest) => void;
  onTest: () => void;
  profile: ProxyProfileSummary | undefined;
  row: ProxyRowDefinition;
  saving: boolean;
  testing: boolean;
}) {
  const [form, setForm] = useState(() => createFormState(row, profile));
  const [localError, setLocalError] = useState<string | null>(null);

  function update(next: Partial<ProxyProfileFormState>) {
    setLocalError(null);
    setForm((current) => ({ ...current, ...next }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = buildProxyProfileRequest(row.kind, form);

    if (!request.ok) {
      setLocalError(request.message);
      return;
    }

    onSubmit(request.value);
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <h3 className="truncate text-sm font-medium text-foreground">{row.title} settings</h3>

      <CommonProxyFields form={form} idPrefix={idPrefix} onUpdate={update} />
      {row.kind === "challenge_solver" ? (
        <ChallengeSolverFields form={form} idPrefix={idPrefix} onUpdate={update} />
      ) : (
        <HttpProxyFields
          form={form}
          hasPassword={Boolean(profile?.hasPassword)}
          idPrefix={idPrefix}
          onUpdate={update}
        />
      )}

      {localError || errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {localError ?? errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/60 pt-2">
        <Button className={proxyInlineActionButtonClassName} disabled={saving} type="submit">
          {saving ? "Saving" : "Save"}
        </Button>
        <Button
          className={proxyInlineActionButtonClassName}
          disabled={!profile || saving || testing}
          onClick={onTest}
          type="button"
          variant="infoOutline"
        >
          {testing ? "Testing" : "Test"}
        </Button>
        <Button
          className={proxyInlineActionButtonClassName}
          disabled={!profile || saving}
          onClick={onClear}
          type="button"
          variant="destructiveOutline"
        >
          Clear
        </Button>
      </div>
    </form>
  );
}

function ClearProxyProfileDialog({
  deleting,
  onClose,
  onConfirm,
  profile,
}: {
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  profile: ProxyProfileSummary | null;
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(profile)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear proxy?</DialogTitle>
          {profile ? <DialogDescription>{profile.name}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button disabled={deleting} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={deleting} onClick={onConfirm} type="button" variant="destructive">
            {deleting ? "Clearing" : "Clear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-1", className)}>{children}</div>;
}

function CommonProxyFields({
  form,
  idPrefix,
  onUpdate,
}: {
  form: ProxyProfileFormState;
  idPrefix: string;
  onUpdate: (next: Partial<ProxyProfileFormState>) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field>
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          className={compactProxyInputClassName}
          id={`${idPrefix}-name`}
          onChange={(event) => onUpdate({ name: event.currentTarget.value })}
          value={form.name}
        />
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-enabled`}>Enabled</Label>
        <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-background/72 px-2.5 shadow-xs">
          <Switch
            checked={form.enabled}
            id={`${idPrefix}-enabled`}
            onCheckedChange={(checked) => onUpdate({ enabled: checked })}
            size="sm"
          />
          <span className="text-sm text-foreground">{form.enabled ? "On" : "Off"}</span>
        </div>
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-scheme`}>Scheme</Label>
        <Select
          onValueChange={(value) => onUpdate({ scheme: value as "http" | "https" })}
          value={form.scheme}
        >
          <SelectTrigger className="w-full" id={`${idPrefix}-scheme`} size="sm">
            <SelectValue placeholder="Scheme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="http">http</SelectItem>
            <SelectItem value="https">https</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-host`}>Host</Label>
        <Input
          className={compactProxyInputClassName}
          id={`${idPrefix}-host`}
          onChange={(event) => onUpdate({ host: event.currentTarget.value })}
          value={form.host}
        />
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-port`}>Port</Label>
        <Input
          className={compactProxyInputClassName}
          id={`${idPrefix}-port`}
          inputMode="numeric"
          onChange={(event) => onUpdate({ port: event.currentTarget.value })}
          value={form.port}
        />
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-timeout`}>Timeout ms</Label>
        <Input
          className={compactProxyInputClassName}
          id={`${idPrefix}-timeout`}
          inputMode="numeric"
          onChange={(event) => onUpdate({ requestTimeoutMs: event.currentTarget.value })}
          value={form.requestTimeoutMs}
        />
      </Field>
    </div>
  );
}

function ChallengeSolverFields({
  form,
  idPrefix,
  onUpdate,
}: {
  form: ProxyProfileFormState;
  idPrefix: string;
  onUpdate: (next: Partial<ProxyProfileFormState>) => void;
}) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`${idPrefix}-variant`}>Variant</Label>
          <Select
            onValueChange={(value) =>
              onUpdate({ variant: value as ProxyProfileFormState["variant"] })
            }
            value={form.variant}
          >
            <SelectTrigger className="w-full" id={`${idPrefix}-variant`} size="sm">
              <SelectValue placeholder="Variant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trawl">Trawl</SelectItem>
              <SelectItem value="flaresolverr">FlareSolverr</SelectItem>
              <SelectItem value="byparr">Byparr</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-path`}>Path</Label>
          <Input
            className={compactProxyInputClassName}
            id={`${idPrefix}-path`}
            onChange={(event) => onUpdate({ path: event.currentTarget.value })}
            value={form.path}
          />
        </Field>
      </div>
      {form.variant === "flaresolverr" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field>
            <Label htmlFor={`${idPrefix}-session-name`}>Session name</Label>
            <Input
              className={compactProxyInputClassName}
              id={`${idPrefix}-session-name`}
              onChange={(event) => onUpdate({ sessionName: event.currentTarget.value })}
              value={form.sessionName}
            />
          </Field>
          <Field>
            <Label htmlFor={`${idPrefix}-session-ttl`}>Session TTL min</Label>
            <Input
              className={compactProxyInputClassName}
              id={`${idPrefix}-session-ttl`}
              inputMode="numeric"
              onChange={(event) => onUpdate({ sessionTtlMinutes: event.currentTarget.value })}
              value={form.sessionTtlMinutes}
            />
          </Field>
        </div>
      ) : null}
    </>
  );
}

function HttpProxyFields({
  form,
  hasPassword,
  idPrefix,
  onUpdate,
}: {
  form: ProxyProfileFormState;
  hasPassword: boolean;
  idPrefix: string;
  onUpdate: (next: Partial<ProxyProfileFormState>) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field>
        <Label htmlFor={`${idPrefix}-username`}>Username</Label>
        <Input
          className={compactProxyInputClassName}
          id={`${idPrefix}-username`}
          onChange={(event) => onUpdate({ username: event.currentTarget.value })}
          value={form.username}
        />
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-password`}>Password</Label>
        <Input
          className={compactProxyInputClassName}
          disabled={form.clearPassword}
          id={`${idPrefix}-password`}
          onChange={(event) =>
            onUpdate({ clearPassword: false, password: event.currentTarget.value })
          }
          placeholder="Saved secret stays hidden."
          type="password"
          value={form.password}
        />
      </Field>
      {hasPassword ? (
        <Field className="sm:col-span-2">
          <Label htmlFor={`${idPrefix}-clear-password`}>Clear saved password</Label>
          <div className="flex h-8 items-center gap-2 rounded-md border border-input bg-background/72 px-2.5 shadow-xs">
            <Switch
              checked={form.clearPassword}
              id={`${idPrefix}-clear-password`}
              onCheckedChange={(checked) =>
                onUpdate({ clearPassword: checked, password: checked ? "" : form.password })
              }
              size="sm"
            />
            <span className="text-sm text-foreground">
              {form.clearPassword ? "Clear on save" : "Keep saved password"}
            </span>
          </div>
        </Field>
      ) : null}
    </div>
  );
}

function createFormState(
  row: ProxyRowDefinition,
  profile: ProxyProfileSummary | undefined,
): ProxyProfileFormState {
  return profile ? createExistingFormState(profile, row) : createNewFormState(row);
}

function createExistingFormState(
  profile: ProxyProfileSummary,
  row: ProxyRowDefinition,
): ProxyProfileFormState {
  return {
    name: profile.name,
    enabled: profile.enabled,
    scheme: profile.scheme,
    host: profile.host,
    port: String(profile.port),
    requestTimeoutMs: String(profile.requestTimeoutMs),
    variant: profile.variant ?? "trawl",
    path: profile.path ?? row.defaultPath ?? "",
    sessionName: profile.sessionName ?? "",
    sessionTtlMinutes: profile.sessionTtlMinutes ? String(profile.sessionTtlMinutes) : "",
    username: profile.username ?? "",
    password: "",
    clearPassword: false,
  };
}

function createNewFormState(row: ProxyRowDefinition): ProxyProfileFormState {
  return {
    name: row.defaultName,
    enabled: true,
    scheme: "http",
    host: "",
    port: row.defaultPort ?? "",
    requestTimeoutMs: "60000",
    variant: "trawl",
    path: row.defaultPath ?? "",
    sessionName: "",
    sessionTtlMinutes: "",
    username: "",
    password: "",
    clearPassword: false,
  };
}

function buildProxyProfileRequest(
  kind: ProxyProfileKind,
  form: ProxyProfileFormState,
): { ok: true; value: UpsertProxyProfileRequest } | { ok: false; message: string } {
  const commonFields = validateCommonFormFields(form);

  if (!commonFields.ok) {
    return commonFields;
  }

  return kind === "challenge_solver"
    ? buildChallengeSolverRequest(form, commonFields.value)
    : buildHttpProxyRequest(form, commonFields.value);
}

function validateCommonFormFields(form: ProxyProfileFormState):
  | {
      ok: true;
      value: {
        enabled: boolean;
        host: string;
        name: string;
        port: number;
        requestTimeoutMs: number;
        scheme: "http" | "https";
      };
    }
  | { ok: false; message: string } {
  const name = form.name.trim();
  const host = form.host.trim();
  const port = readIntegerInput(form.port);
  const requestTimeoutMs = readIntegerInput(form.requestTimeoutMs);

  if (!name) {
    return { ok: false, message: "Proxy name is required." };
  }

  if (!host) {
    return { ok: false, message: "Host is required." };
  }

  if (port === null || !Number.isInteger(port) || port < 1 || port > 65_535) {
    return { ok: false, message: "Port must be between 1 and 65535." };
  }

  if (
    requestTimeoutMs === null ||
    !Number.isInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1_000 ||
    requestTimeoutMs > 300_000
  ) {
    return { ok: false, message: "Timeout must be between 1000 and 300000 ms." };
  }

  return {
    ok: true,
    value: {
      enabled: form.enabled,
      host,
      name,
      port,
      requestTimeoutMs,
      scheme: form.scheme,
    },
  };
}

function buildChallengeSolverRequest(
  form: ProxyProfileFormState,
  commonFields: {
    enabled: boolean;
    host: string;
    name: string;
    port: number;
    requestTimeoutMs: number;
    scheme: "http" | "https";
  },
): { ok: true; value: UpsertProxyProfileRequest } | { ok: false; message: string } {
  const sessionTtlMinutes = form.sessionTtlMinutes.trim()
    ? readIntegerInput(form.sessionTtlMinutes)
    : null;

  if (form.variant === "flaresolverr" && form.sessionTtlMinutes.trim()) {
    if (sessionTtlMinutes === null || sessionTtlMinutes < 1 || sessionTtlMinutes > 1_440) {
      return { ok: false, message: "Session TTL must be between 1 and 1440 minutes." };
    }

    if (!form.sessionName.trim()) {
      return { ok: false, message: "Session name is required when session TTL is set." };
    }
  }

  return {
    ok: true,
    value: {
      kind: "challenge_solver",
      ...commonFields,
      variant: form.variant,
      path: form.path.trim() || "/v1",
      sessionName: form.variant === "flaresolverr" ? form.sessionName.trim() || null : null,
      sessionTtlMinutes:
        form.variant === "flaresolverr" && sessionTtlMinutes !== null ? sessionTtlMinutes : null,
    },
  };
}

function buildHttpProxyRequest(
  form: ProxyProfileFormState,
  commonFields: {
    enabled: boolean;
    host: string;
    name: string;
    port: number;
    requestTimeoutMs: number;
    scheme: "http" | "https";
  },
): { ok: true; value: UpsertProxyProfileRequest } {
  return {
    ok: true,
    value: {
      kind: "http_proxy",
      ...commonFields,
      username: form.username.trim() || null,
      ...(form.clearPassword ? { clearPassword: true } : {}),
      ...(form.password.trim() ? { password: form.password.trim() } : {}),
    },
  };
}

function readIntegerInput(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+$/u.test(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 10);
}

function readStatusBadge(profile: ProxyProfileSummary | undefined): StatusBadge {
  if (!profile) {
    return { label: "Not configured", variant: "outline" };
  }

  if (!profile.enabled) {
    return { label: "Disabled", variant: "secondary" };
  }

  switch (profile.lastTestOutcome) {
    case "success":
      return { label: "Connected", variant: "success" };
    case "failed":
      return { label: "Failed", variant: "destructive" };
    case "skipped":
      return { label: "Skipped", variant: "secondary" };
    default:
      return { label: "Not tested", variant: "outline" };
  }
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

function readMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError && error.fieldErrors?.[0]) {
    return error.fieldErrors[0].message;
  }

  return error instanceof Error ? error.message : fallback;
}
