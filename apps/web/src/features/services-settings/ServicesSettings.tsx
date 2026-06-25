import type {
  DownloadClientKind,
  DownloadClientProbeResponse,
  DownloadClientSavedConfig,
  NotificationPreferences,
  UpsertDownloadClientRequest,
} from "@arrtemplar/shared";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { type FormEvent, useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { notify } from "@/features/notifications/notification-gateway";
import { SettingsAccordionCard } from "@/features/settings/SettingsAccordionCard";
import { SettingsRow, SettingsStatus } from "@/features/settings/SettingsPrimitives";
import { ApiClientError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import {
  type SaveDownloadClientConfigVariables,
  useDeleteDownloadClientByIdMutation,
  useDownloadClientConfigsQuery,
  useDownloadClientStatusQuery,
  useTestDownloadClientByIdMutation,
  useTestDownloadClientMutation,
  useUpsertDownloadClientMutation,
} from "./services-settings";

type DownloadClientCardDefinition = {
  kind: DownloadClientKind;
  title: string;
  logoPath: string;
  authModeOptions: Array<{
    label: string;
    value: UpsertDownloadClientRequest["authMode"];
  }>;
};

type DownloadClientFormState = {
  displayName: string;
  enabled: boolean;
  useSsl: boolean;
  host: string;
  port: string;
  urlBase: string;
  authMode: UpsertDownloadClientRequest["authMode"];
  username: string;
  apiKey: string;
  password: string;
};

type DraftServiceInstance = {
  id: string;
  kind: DownloadClientKind;
  displayName: string;
};

type ServiceListItem = {
  card: DownloadClientCardDefinition;
  config?: DownloadClientSavedConfig | undefined;
  draft?: DraftServiceInstance | undefined;
  key: string;
  mode: SaveDownloadClientConfigVariables["mode"];
};

type StatusBadge = {
  label: string;
  variant: "default" | "destructive" | "outline" | "secondary";
};
type FormUpdate = (next: Partial<DownloadClientFormState>) => void;
type SaveMutation = ReturnType<typeof useUpsertDownloadClientMutation>;
type DeleteByIdMutation = ReturnType<typeof useDeleteDownloadClientByIdMutation>;
type TestDefaultMutation = ReturnType<typeof useTestDownloadClientMutation>;
type TestByIdMutation = ReturnType<typeof useTestDownloadClientByIdMutation>;

const maxServiceInstancesPerKind = 10;
const deleteConfirmationPreferenceKey = "arrtemplar.services.skip-delete-confirmation";

const downloadClientCards: readonly DownloadClientCardDefinition[] = [
  {
    kind: "qbittorrent",
    title: "qBittorrent",
    logoPath: "/services/qbittorrent.svg",
    authModeOptions: [
      { label: "API key", value: "api_key" },
      { label: "Username and password", value: "username_password" },
    ],
  },
  {
    kind: "sabnzbd",
    title: "SABnzbd",
    logoPath: "/services/sabnzbd.svg",
    authModeOptions: [
      { label: "API key", value: "api_key" },
      { label: "Username and password", value: "username_password" },
    ],
  },
] as const;

const compactDownloadClientFieldClassName = "h-9 w-full min-w-0 rounded-xl px-3 text-sm sm:w-52";

const selectClassName = `${compactDownloadClientFieldClassName} border border-input bg-background/50 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] outline-none transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`;

export function ServicesSettings() {
  const actor = useAuthenticatedRouteUser();
  const configsQuery = useDownloadClientConfigsQuery();
  const [drafts, setDrafts] = useState<DraftServiceInstance[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const configsByKind = useMemo(
    () => groupConfigsByKind(configsQuery.data ?? []),
    [configsQuery.data],
  );
  const draftCountsByKind = useMemo(() => countDraftsByKind(drafts), [drafts]);

  function readInstanceCount(kind: DownloadClientKind): number {
    const savedConfigs = configsByKind.get(kind) ?? [];
    const savedDefaultCount = savedConfigs.some((config) => config.isDefault) ? 1 : 0;
    const savedAdditionalCount = savedConfigs.filter((config) => !config.isDefault).length;
    return (
      Math.max(savedDefaultCount, 1) + savedAdditionalCount + (draftCountsByKind.get(kind) ?? 0)
    );
  }

  function handleAddService(kind: DownloadClientKind) {
    const card = readCardDefinition(kind);
    const nextCount = readInstanceCount(kind) + 1;

    if (!card) {
      return;
    }

    if (nextCount > maxServiceInstancesPerKind) {
      notify(
        {
          id: "services.add.failed",
          title: `${card.title} limit reached.`,
          description: `Up to ${maxServiceInstancesPerKind} instances per service type.`,
        },
        actor.notificationPreferences,
      );
      return;
    }

    const displayName = `${card.title} ${nextCount}`;

    setDrafts((current) => [
      ...current,
      {
        displayName,
        id: `draft-${kind}-${crypto.randomUUID()}`,
        kind,
      },
    ]);
    setAddDialogOpen(false);
    notify(
      {
        id: "services.added",
        title: "Service added.",
        description: displayName,
      },
      actor.notificationPreferences,
    );
  }

  function removeDraft(draftId: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
  }

  if (configsQuery.isLoading) {
    return <ServicesSettingsSkeleton />;
  }

  if (configsQuery.isError) {
    return (
      <Card className="border-destructive/35 bg-destructive/5 shadow-none">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">
            Services settings failed to load.
          </CardTitle>
          <CardDescription>
            Reload the page or try again after the API is reachable.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {downloadClientCards.map((card) => (
          <div className="min-w-0 space-y-3" key={card.kind}>
            {createServiceItems(card, configsByKind.get(card.kind) ?? [], drafts).map((item) => (
              <DownloadClientCard
                item={item}
                key={item.key}
                notificationPreferences={actor.notificationPreferences}
                onDraftRemoved={removeDraft}
                onDraftSaved={removeDraft}
              />
            ))}
          </div>
        ))}
      </div>
      <AddServicePill onClick={() => setAddDialogOpen(true)} />
      <AddServiceDialog
        instanceCounts={
          new Map(downloadClientCards.map((card) => [card.kind, readInstanceCount(card.kind)]))
        }
        onAddService={handleAddService}
        onOpenChange={setAddDialogOpen}
        open={addDialogOpen}
      />
    </div>
  );
}

function ServicesSettingsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-18 rounded-2xl" />
        <Skeleton className="h-18 rounded-2xl" />
      </div>
      <Skeleton className="h-16 rounded-2xl" />
    </div>
  );
}

function DownloadClientCard({
  item,
  notificationPreferences,
  onDraftRemoved,
  onDraftSaved,
}: {
  item: ServiceListItem;
  notificationPreferences: NotificationPreferences;
  onDraftRemoved: (draftId: string) => void;
  onDraftSaved: (draftId: string) => void;
}) {
  const controller = useDownloadClientCardController({
    item,
    notificationPreferences,
    onDraftRemoved,
    onDraftSaved,
  });

  return <DownloadClientCardView controller={controller} />;
}

function useDownloadClientCardController({
  item,
  notificationPreferences,
  onDraftRemoved,
  onDraftSaved,
}: {
  item: ServiceListItem;
  notificationPreferences: NotificationPreferences;
  onDraftRemoved: (draftId: string) => void;
  onDraftSaved: (draftId: string) => void;
}) {
  const { card, config, draft, mode } = item;
  const statusQuery = useDownloadClientStatusQuery(
    config,
    card.kind,
    shouldQueryStatus(mode, config),
  );
  const saveMutation = useUpsertDownloadClientMutation();
  const deleteMutation = useDeleteDownloadClientByIdMutation();
  const testDefaultMutation = useTestDownloadClientMutation();
  const testByIdMutation = useTestDownloadClientByIdMutation();
  const [form, setForm] = useState(() => createFormState(card, config, draft));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const statusId = useId();
  const isBusy = readBusyState(saveMutation, deleteMutation, testDefaultMutation, testByIdMutation);
  const isDraft = isDraftServiceItem(mode, config);
  const probeResponse = readVisibleProbeResponse(
    isDraft,
    testDefaultMutation.data,
    testByIdMutation.data,
    statusQuery.data,
  );
  const statusBadge = readCardStatusBadge(probeResponse, statusQuery.isLoading, isDraft);
  const title = readCardTitle(form, card);

  function updateForm(next: Partial<DownloadClientFormState>) {
    setErrorMessage(null);
    setStatusMessage(null);
    setForm((current) => ({ ...current, ...next }));
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitDownloadClientForm({
      card,
      config,
      draft,
      form,
      mode,
      notificationPreferences,
      onDraftSaved,
      saveMutation,
      setErrorMessage,
      setForm,
      setStatusMessage,
      title,
    });
  }

  function handleTest() {
    testDownloadClientFromCard({
      card,
      config,
      onError: handleTestError,
      onSuccess: handleTestSuccess,
      setErrorMessage,
      setStatusMessage,
      testByIdMutation,
      testDefaultMutation,
    });
  }

  function handleTestSuccess(result: DownloadClientProbeResponse) {
    applyProbeResultStatus(result, setStatusMessage, setErrorMessage);
    notify(
      {
        id: "services.tested",
        title: "Connection test passed.",
        description: title,
      },
      notificationPreferences,
    );
  }

  function handleTestError(error: Error) {
    const message = readTestErrorMessage(error, title);

    setErrorMessage(message);
    notify(
      {
        id: "services.test.failed",
        title: message,
        description: title,
      },
      notificationPreferences,
    );
  }

  function handleDeleteRequest() {
    requestDeleteConfirmation(executeDelete, setDeleteDialogOpen);
  }

  function executeDelete() {
    deleteDownloadClientFromCard({
      config,
      deleteMutation,
      draft,
      notificationPreferences,
      onDraftRemoved,
      setErrorMessage,
      setStatusMessage,
      title,
    });
  }

  return {
    card,
    config,
    deleteDialogOpen,
    errorMessage,
    executeDelete,
    form,
    handleDeleteRequest,
    handleSave,
    handleTest,
    isBusy,
    item,
    probeResponse,
    saveMutation,
    setDeleteDialogOpen,
    statusBadge,
    statusId,
    statusMessage,
    testByIdMutation,
    testDefaultMutation,
    title,
    updateForm,
  };
}

function shouldQueryStatus(
  mode: SaveDownloadClientConfigVariables["mode"],
  config: DownloadClientSavedConfig | undefined,
): boolean {
  return mode === "default" || Boolean(config);
}

function readBusyState(
  saveMutation: SaveMutation,
  deleteMutation: DeleteByIdMutation,
  testDefaultMutation: TestDefaultMutation,
  testByIdMutation: TestByIdMutation,
): boolean {
  return [
    saveMutation.isPending,
    deleteMutation.isPending,
    testDefaultMutation.isPending,
    testByIdMutation.isPending,
  ].some(Boolean);
}

function isDraftServiceItem(
  mode: SaveDownloadClientConfigVariables["mode"],
  config: DownloadClientSavedConfig | undefined,
): boolean {
  return mode === "instance" && !config;
}

function readVisibleProbeResponse(
  isDraft: boolean,
  defaultProbe: DownloadClientProbeResponse | undefined,
  instanceProbe: DownloadClientProbeResponse | undefined,
  statusProbe: DownloadClientProbeResponse | undefined,
): DownloadClientProbeResponse | undefined {
  if (isDraft) {
    return undefined;
  }

  return defaultProbe ?? instanceProbe ?? statusProbe;
}

function readCardStatusBadge(
  probeResponse: DownloadClientProbeResponse | undefined,
  isLoading: boolean,
  isDraft: boolean,
): StatusBadge {
  return readStatusBadge(probeResponse?.result, isLoading, isDraft);
}

function readCardTitle(form: DownloadClientFormState, card: DownloadClientCardDefinition): string {
  return form.displayName.trim() || card.title;
}

function applyProbeResultStatus(
  result: DownloadClientProbeResponse,
  setStatusMessage: (message: string | null) => void,
  setErrorMessage: (message: string | null) => void,
) {
  setStatusMessage(result.result.summary);
  setErrorMessage(result.error?.fieldErrors?.[0]?.message ?? result.error?.message ?? null);
}

function readTestErrorMessage(error: Error, title: string): string {
  return error.message || `${title} test failed.`;
}

function submitDownloadClientForm({
  card,
  config,
  draft,
  form,
  mode,
  notificationPreferences,
  onDraftSaved,
  saveMutation,
  setErrorMessage,
  setForm,
  setStatusMessage,
  title,
}: {
  card: DownloadClientCardDefinition;
  config: DownloadClientSavedConfig | undefined;
  draft: DraftServiceInstance | undefined;
  form: DownloadClientFormState;
  mode: SaveDownloadClientConfigVariables["mode"];
  notificationPreferences: NotificationPreferences;
  onDraftSaved: (draftId: string) => void;
  saveMutation: SaveMutation;
  setErrorMessage: (message: string | null) => void;
  setForm: (form: DownloadClientFormState) => void;
  setStatusMessage: (message: string | null) => void;
  title: string;
}) {
  const request = readUpsertRequest(form, card);

  if (!request.ok) {
    setErrorMessage(request.message);
    notify(
      {
        id: "services.save.failed",
        title: request.message,
        description: title,
      },
      notificationPreferences,
    );
    return;
  }

  saveMutation.mutate(
    { config, input: request.value, kind: card.kind, mode },
    {
      onSuccess: (savedConfig) => {
        setForm(createFormState(card, savedConfig));
        setStatusMessage(`${savedConfig.displayName} settings saved.`);
        notify(
          {
            id: "services.saved",
            title: "Service settings saved.",
            description: savedConfig.displayName,
          },
          notificationPreferences,
        );
        if (draft) {
          onDraftSaved(draft.id);
        }
      },
      onError: (error) => {
        const message = readSaveErrorMessage(error, title);

        setErrorMessage(message);
        notify(
          {
            id: "services.save.failed",
            title: message,
            description: title,
          },
          notificationPreferences,
        );
      },
    },
  );
}

function testDownloadClientFromCard({
  card,
  config,
  onError,
  onSuccess,
  setErrorMessage,
  setStatusMessage,
  testByIdMutation,
  testDefaultMutation,
}: {
  card: DownloadClientCardDefinition;
  config: DownloadClientSavedConfig | undefined;
  onError: (error: Error) => void;
  onSuccess: (result: DownloadClientProbeResponse) => void;
  setErrorMessage: (message: string | null) => void;
  setStatusMessage: (message: string | null) => void;
  testByIdMutation: TestByIdMutation;
  testDefaultMutation: TestDefaultMutation;
}) {
  if (!config) {
    return;
  }

  setErrorMessage(null);
  setStatusMessage(null);

  if (config.isDefault) {
    testDefaultMutation.mutate(card.kind, { onError, onSuccess });
    return;
  }

  testByIdMutation.mutate(config, { onError, onSuccess });
}

function requestDeleteConfirmation(
  executeDelete: () => void,
  setDeleteDialogOpen: (open: boolean) => void,
) {
  if (readDeleteConfirmationPreference()) {
    executeDelete();
    return;
  }

  setDeleteDialogOpen(true);
}

function deleteDownloadClientFromCard({
  config,
  deleteMutation,
  draft,
  notificationPreferences,
  onDraftRemoved,
  setErrorMessage,
  setStatusMessage,
  title,
}: {
  config: DownloadClientSavedConfig | undefined;
  deleteMutation: DeleteByIdMutation;
  draft: DraftServiceInstance | undefined;
  notificationPreferences: NotificationPreferences;
  onDraftRemoved: (draftId: string) => void;
  setErrorMessage: (message: string | null) => void;
  setStatusMessage: (message: string | null) => void;
  title: string;
}) {
  if (draft) {
    onDraftRemoved(draft.id);
    return;
  }

  if (!config || config.isDefault) {
    return;
  }

  deleteMutation.mutate(config.id, {
    onSuccess: () => {
      setStatusMessage(`${title} removed.`);
      notify(
        {
          id: "services.deleted",
          title: "Service removed.",
          description: title,
        },
        notificationPreferences,
      );
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : `${title} removal failed.`;

      setErrorMessage(message);
      notify(
        {
          id: "services.delete.failed",
          title: message,
          description: title,
        },
        notificationPreferences,
      );
    },
  });
}

function readSaveErrorMessage(error: unknown, title: string): string {
  if (error instanceof ApiClientError && error.fieldErrors?.[0]) {
    return error.fieldErrors[0].message;
  }

  return error instanceof Error ? error.message : `${title} save failed.`;
}

function DownloadClientCardView({
  controller,
}: {
  controller: ReturnType<typeof useDownloadClientCardController>;
}) {
  const {
    card,
    config,
    deleteDialogOpen,
    errorMessage,
    executeDelete,
    form,
    handleDeleteRequest,
    handleSave,
    handleTest,
    isBusy,
    item,
    probeResponse,
    saveMutation,
    setDeleteDialogOpen,
    statusBadge,
    statusId,
    statusMessage,
    testByIdMutation,
    testDefaultMutation,
    title,
    updateForm,
  } = controller;
  const apiKeyDescription = readSecretDescription(config, "apiKey");
  const passwordDescription = readSecretDescription(config, "password");
  const canDelete = item.mode === "instance";
  const isTesting = testDefaultMutation.isPending || testByIdMutation.isPending;
  const contentId = `${item.key}-settings`;
  const [isExpanded, setIsExpanded] = useState(item.mode === "default" || Boolean(item.draft));

  return (
    <>
      <SettingsAccordionCard
        action={
          <DownloadClientCardActions
            canDelete={canDelete}
            enabled={form.enabled}
            isBusy={isBusy}
            onDeleteRequest={handleDeleteRequest}
            onEnabledChange={(enabled) => updateForm({ enabled })}
            statusBadge={statusBadge}
            title={title}
          />
        }
        contentId={contentId}
        icon={<ServiceLogo card={card} />}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
        title={title}
        toggleLabel={`${isExpanded ? "Collapse" : "Expand"} ${title} service settings`}
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <DownloadClientFormFields
            apiKeyDescription={apiKeyDescription}
            card={card}
            form={form}
            isBusy={isBusy}
            itemKey={item.key}
            passwordDescription={passwordDescription}
            title={title}
            updateForm={updateForm}
          />
          <SettingsStatus
            errorMessage={errorMessage}
            statusId={statusId}
            statusMessage={statusMessage}
          />
          <DownloadClientFormFooter
            canTest={Boolean(config)}
            isBusy={isBusy}
            isDraft={Boolean(item.draft)}
            isSaving={saveMutation.isPending}
            isTesting={isTesting}
            onTest={handleTest}
            probeResponse={probeResponse}
          />
        </form>
      </SettingsAccordionCard>
      <DownloadClientDeleteDialogSlot
        canDelete={canDelete}
        onConfirmDelete={executeDelete}
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
        serviceName={title}
      />
    </>
  );
}

function DownloadClientCardActions({
  canDelete,
  enabled,
  isBusy,
  onDeleteRequest,
  onEnabledChange,
  statusBadge,
  title,
}: {
  canDelete: boolean;
  enabled: boolean;
  isBusy: boolean;
  onDeleteRequest: () => void;
  onEnabledChange: (enabled: boolean) => void;
  statusBadge: StatusBadge;
  title: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      <ServiceEnabledToggle disabled={isBusy} enabled={enabled} onChange={onEnabledChange} />
      {canDelete ? (
        <Button
          aria-label={`Remove ${title}`}
          className="size-9 rounded-xl"
          disabled={isBusy}
          onClick={onDeleteRequest}
          size="icon"
          type="button"
          variant="ghost"
        >
          <TrashIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

function DownloadClientFormFields({
  apiKeyDescription,
  card,
  form,
  isBusy,
  itemKey,
  passwordDescription,
  title,
  updateForm,
}: {
  apiKeyDescription: string | undefined;
  card: DownloadClientCardDefinition;
  form: DownloadClientFormState;
  isBusy: boolean;
  itemKey: string;
  passwordDescription: string | undefined;
  title: string;
  updateForm: FormUpdate;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      <SettingsRow controlId={`${itemKey}-display-name`} density="compact" label="Service name">
        <Input
          className={compactDownloadClientFieldClassName}
          disabled={isBusy}
          id={`${itemKey}-display-name`}
          onChange={(event) => updateForm({ displayName: event.currentTarget.value })}
          placeholder={card.title}
          value={form.displayName}
        />
      </SettingsRow>
      <SettingsRow controlId={`${itemKey}-host`} density="compact" label="Host">
        <Input
          className={compactDownloadClientFieldClassName}
          disabled={isBusy}
          id={`${itemKey}-host`}
          onChange={(event) => updateForm({ host: event.currentTarget.value })}
          placeholder="hostname or LAN IP"
          value={form.host}
        />
      </SettingsRow>
      <SettingsRow controlId={`${itemKey}-port`} density="compact" label="Port">
        <Input
          className="h-9 w-28 rounded-xl px-3 text-sm"
          disabled={isBusy}
          id={`${itemKey}-port`}
          inputMode="numeric"
          onChange={(event) => updateForm({ port: event.currentTarget.value })}
          placeholder="8080"
          value={form.port}
        />
      </SettingsRow>
      <SettingsRow controlId={`${itemKey}-use-ssl`} density="compact" label="Use HTTPS">
        <input
          aria-label={`Use HTTPS for ${title}`}
          checked={form.useSsl}
          className="size-4 rounded border-border accent-primary"
          disabled={isBusy}
          id={`${itemKey}-use-ssl`}
          onChange={(event) => updateForm({ useSsl: event.currentTarget.checked })}
          type="checkbox"
        />
      </SettingsRow>
      <SettingsRow controlId={`${itemKey}-url-base`} density="compact" label="URL base">
        <Input
          className={compactDownloadClientFieldClassName}
          disabled={isBusy}
          id={`${itemKey}-url-base`}
          onChange={(event) => updateForm({ urlBase: event.currentTarget.value })}
          placeholder="/subpath"
          value={form.urlBase}
        />
      </SettingsRow>
      <SettingsRow controlId={`${itemKey}-auth-mode`} density="compact" label="Auth mode">
        <select
          className={selectClassName}
          disabled={isBusy}
          id={`${itemKey}-auth-mode`}
          onChange={(event) =>
            updateForm({
              authMode: event.currentTarget.value as DownloadClientFormState["authMode"],
            })
          }
          value={form.authMode}
        >
          {card.authModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </SettingsRow>
      <DownloadClientCredentialFields
        apiKeyDescription={apiKeyDescription}
        form={form}
        isBusy={isBusy}
        itemKey={itemKey}
        passwordDescription={passwordDescription}
        updateForm={updateForm}
      />
    </div>
  );
}

function DownloadClientCredentialFields({
  apiKeyDescription,
  form,
  isBusy,
  itemKey,
  passwordDescription,
  updateForm,
}: {
  apiKeyDescription: string | undefined;
  form: DownloadClientFormState;
  isBusy: boolean;
  itemKey: string;
  passwordDescription: string | undefined;
  updateForm: FormUpdate;
}) {
  if (form.authMode === "username_password") {
    return (
      <>
        <SettingsRow controlId={`${itemKey}-username`} density="compact" label="Username">
          <Input
            className={compactDownloadClientFieldClassName}
            disabled={isBusy}
            id={`${itemKey}-username`}
            onChange={(event) => updateForm({ username: event.currentTarget.value })}
            value={form.username}
          />
        </SettingsRow>
        <PasswordField
          description={passwordDescription}
          isBusy={isBusy}
          itemKey={itemKey}
          updateForm={updateForm}
          value={form.password}
        />
      </>
    );
  }

  return (
    <ApiKeyField
      description={apiKeyDescription}
      isBusy={isBusy}
      itemKey={itemKey}
      updateForm={updateForm}
      value={form.apiKey}
    />
  );
}

function ApiKeyField({
  description,
  isBusy,
  itemKey,
  updateForm,
  value,
}: {
  description: string | undefined;
  isBusy: boolean;
  itemKey: string;
  updateForm: FormUpdate;
  value: string;
}) {
  return (
    <SettingsRow
      controlId={`${itemKey}-api-key`}
      density="compact"
      label="API key"
      {...(description ? { description } : {})}
    >
      <Input
        autoComplete="off"
        className={compactDownloadClientFieldClassName}
        disabled={isBusy}
        id={`${itemKey}-api-key`}
        onChange={(event) => updateForm({ apiKey: event.currentTarget.value })}
        placeholder="Saved key stays hidden"
        type="password"
        value={value}
      />
    </SettingsRow>
  );
}

function PasswordField({
  description,
  isBusy,
  itemKey,
  updateForm,
  value,
}: {
  description: string | undefined;
  isBusy: boolean;
  itemKey: string;
  updateForm: FormUpdate;
  value: string;
}) {
  return (
    <SettingsRow
      controlId={`${itemKey}-password`}
      density="compact"
      label="Password"
      {...(description ? { description } : {})}
    >
      <Input
        autoComplete="off"
        className={compactDownloadClientFieldClassName}
        disabled={isBusy}
        id={`${itemKey}-password`}
        onChange={(event) => updateForm({ password: event.currentTarget.value })}
        placeholder="Saved password stays hidden"
        type="password"
        value={value}
      />
    </SettingsRow>
  );
}

function DownloadClientFormFooter({
  canTest,
  isBusy,
  isDraft,
  isSaving,
  isTesting,
  onTest,
  probeResponse,
}: {
  canTest: boolean;
  isBusy: boolean;
  isDraft: boolean;
  isSaving: boolean;
  isTesting: boolean;
  onTest: () => void;
  probeResponse: DownloadClientProbeResponse | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-h-5 text-sm text-muted-foreground">
        {readFooterSummary(probeResponse, isDraft)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={isBusy || !canTest} onClick={onTest} type="button" variant="outline">
          {isTesting ? "Testing" : "Test connection"}
        </Button>
        <Button disabled={isBusy} type="submit">
          {isSaving ? "Saving" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

function DownloadClientDeleteDialogSlot({
  canDelete,
  onConfirmDelete,
  onOpenChange,
  open,
  serviceName,
}: {
  canDelete: boolean;
  onConfirmDelete: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  serviceName: string;
}) {
  if (!canDelete) {
    return null;
  }

  return (
    <DeleteServiceDialog
      onConfirmDelete={onConfirmDelete}
      onOpenChange={onOpenChange}
      open={open}
      serviceName={serviceName}
    />
  );
}

function readFooterSummary(
  probeResponse: DownloadClientProbeResponse | undefined,
  isDraft: boolean,
): string {
  return probeResponse?.result.summary ?? (isDraft ? "Save this service before testing." : "");
}

function AddServicePill({ onClick }: { onClick: () => void }) {
  return (
    <button
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card/35 p-3 text-left transition-colors duration-200",
        "hover:border-primary/50 hover:bg-card/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-secondary-foreground">
          <PlusIcon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground sm:text-base">
            Add another service
          </span>
          <span className="block text-sm text-muted-foreground">
            Create another qBittorrent or SABnzbd instance.
          </span>
        </span>
      </span>
    </button>
  );
}

function AddServiceDialog({
  instanceCounts,
  onAddService,
  onOpenChange,
  open,
}: {
  instanceCounts: Map<DownloadClientKind, number>;
  onAddService: (kind: DownloadClientKind) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add another service</DialogTitle>
          <DialogDescription>
            Choose a downloader type. Each service type supports up to 10 instances.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {downloadClientCards.map((card) => {
            const count = instanceCounts.get(card.kind) ?? 1;
            const isAtLimit = count >= maxServiceInstancesPerKind;

            return (
              <Button
                className="h-auto justify-start rounded-2xl border-border bg-card/60 p-3 text-left"
                disabled={isAtLimit}
                key={card.kind}
                onClick={() => onAddService(card.kind)}
                type="button"
                variant="outline"
              >
                <img alt="" className="h-8 w-auto shrink-0" src={card.logoPath} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{card.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {isAtLimit ? "Limit reached" : `${count}/${maxServiceInstancesPerKind} used`}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteServiceDialog({
  onConfirmDelete,
  onOpenChange,
  open,
  serviceName,
}: {
  onConfirmDelete: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  serviceName: string;
}) {
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);
  const [remember, setRemember] = useState(false);
  const canRemember = choice !== null;

  function handleConfirm() {
    if (!choice) {
      return;
    }

    if (remember) {
      writeDeleteConfirmationPreference();
    }

    if (choice === "yes") {
      onConfirmDelete();
    }

    onOpenChange(false);
    setChoice(null);
    setRemember(false);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Delete {serviceName}?</DialogTitle>
          <DialogDescription>
            This removes this additional service instance. The original service stays available.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div
            aria-label="Delete service choice"
            className="grid gap-2 sm:grid-cols-2"
            role="radiogroup"
          >
            <ChoiceButton
              choice="yes"
              currentChoice={choice}
              label="Yes, delete"
              onChoose={setChoice}
            />
            <ChoiceButton
              choice="no"
              currentChoice={choice}
              label="No, keep it"
              onChoose={setChoice}
            />
          </div>
          <label
            className={cn(
              "flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 text-sm",
              !canRemember && "cursor-not-allowed opacity-55",
            )}
          >
            <input
              checked={remember}
              className="size-4 rounded border-border accent-primary"
              disabled={!canRemember}
              onChange={(event) => setRemember(event.currentTarget.checked)}
              type="checkbox"
            />
            Do not show again
          </label>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={!choice}
            onClick={handleConfirm}
            type="button"
            variant={choice === "yes" ? "destructive" : "secondary"}
          >
            {choice === "yes" ? "Delete service" : "Keep service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceButton({
  choice,
  currentChoice,
  label,
  onChoose,
}: {
  choice: "yes" | "no";
  currentChoice: "yes" | "no" | null;
  label: string;
  onChoose: (choice: "yes" | "no") => void;
}) {
  const selected = choice === currentChoice;

  return (
    <label
      className={cn(
        "rounded-xl border border-border bg-card/50 px-3 py-2 text-left text-sm transition-colors",
        selected && "border-primary/60 bg-primary/15 text-primary",
      )}
    >
      <input
        checked={selected}
        className="sr-only"
        name="delete-service-choice"
        onChange={() => onChoose(choice)}
        type="radio"
        value={choice}
      />
      {label}
    </label>
  );
}

function ServiceLogo({ card }: { card: DownloadClientCardDefinition }) {
  return <img alt="" className="h-8 w-auto shrink-0" src={card.logoPath} />;
}

function ServiceEnabledToggle({
  disabled,
  enabled,
  onChange,
}: {
  disabled: boolean;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card/65 px-2.5 py-1.5 text-xs font-medium",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        aria-label="Enable service integration"
        checked={enabled}
        className="peer sr-only"
        disabled={disabled}
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

function readStatusBadge(
  status: DownloadClientProbeResponse["result"] | undefined,
  loading: boolean,
  isDraft: boolean,
): StatusBadge {
  if (isDraft) {
    return { label: "New", variant: "outline" };
  }

  if (loading && !status) {
    return { label: "Checking", variant: "outline" };
  }

  if (!status) {
    return { label: "Unknown", variant: "secondary" };
  }

  switch (status.outcome) {
    case "success":
      return { label: "Connected", variant: "default" };
    case "disabled":
      return { label: "Disabled", variant: "secondary" };
    case "not_configured":
      return { label: "Not configured", variant: "secondary" };
    case "error":
      return { label: "Issue", variant: "destructive" };
  }
}

function createFormState(
  card: DownloadClientCardDefinition,
  config?: DownloadClientSavedConfig,
  draft?: DraftServiceInstance,
): DownloadClientFormState {
  if (!config) {
    return createEmptyFormState(draft?.displayName ?? card.title);
  }

  return {
    displayName: config.displayName,
    enabled: config.enabled,
    useSsl: config.useSsl,
    host: config.host,
    port: String(config.port),
    urlBase: config.urlBase ?? "",
    authMode: config.authMode,
    username: config.username ?? "",
    apiKey: "",
    password: "",
  };
}

function createEmptyFormState(displayName: string): DownloadClientFormState {
  return {
    displayName,
    enabled: false,
    useSsl: false,
    host: "",
    port: "",
    urlBase: "",
    authMode: "api_key",
    username: "",
    apiKey: "",
    password: "",
  };
}

function readUpsertRequest(
  form: DownloadClientFormState,
  card: DownloadClientCardDefinition,
): { ok: true; value: UpsertDownloadClientRequest } | { ok: false; message: string } {
  const displayName = form.displayName.trim() || card.title;
  const host = form.host.trim();
  const port = Number.parseInt(form.port, 10);

  if (!host) {
    return { ok: false, message: `${displayName} host is required.` };
  }

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    return { ok: false, message: `${displayName} port must be between 1 and 65535.` };
  }

  if (form.authMode === "username_password" && !form.username.trim()) {
    return { ok: false, message: `${displayName} username is required.` };
  }

  return {
    ok: true,
    value: {
      displayName,
      enabled: form.enabled,
      useSsl: form.useSsl,
      host,
      port,
      urlBase: form.urlBase.trim() ? form.urlBase.trim() : null,
      authMode: form.authMode,
      ...(form.username.trim() ? { username: form.username.trim() } : {}),
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      ...(form.password ? { password: form.password } : {}),
    },
  };
}

function readSecretDescription(
  config: DownloadClientSavedConfig | undefined,
  field: "apiKey" | "password",
): string | undefined {
  if (!config) {
    return undefined;
  }

  if (field === "apiKey" && config.hasApiKey) {
    return "Leave blank to keep the saved API key.";
  }

  if (field === "password" && config.hasPassword) {
    return "Leave blank to keep the saved password.";
  }

  return undefined;
}

function groupConfigsByKind(
  configs: readonly DownloadClientSavedConfig[],
): Map<DownloadClientKind, DownloadClientSavedConfig[]> {
  const grouped = new Map<DownloadClientKind, DownloadClientSavedConfig[]>();

  for (const config of configs) {
    grouped.set(config.kind, [...(grouped.get(config.kind) ?? []), config]);
  }

  return grouped;
}

function countDraftsByKind(
  drafts: readonly DraftServiceInstance[],
): Map<DownloadClientKind, number> {
  const counts = new Map<DownloadClientKind, number>();

  for (const draft of drafts) {
    counts.set(draft.kind, (counts.get(draft.kind) ?? 0) + 1);
  }

  return counts;
}

function createServiceItems(
  card: DownloadClientCardDefinition,
  configs: readonly DownloadClientSavedConfig[],
  drafts: readonly DraftServiceInstance[],
): ServiceListItem[] {
  const defaultConfig = configs.find((config) => config.isDefault);
  const additionalConfigs = configs.filter((config) => !config.isDefault);
  const matchingDrafts = drafts.filter((draft) => draft.kind === card.kind);

  return [
    { card, config: defaultConfig, key: `${card.kind}-default`, mode: "default" },
    ...additionalConfigs.map((config) => ({
      card,
      config,
      key: config.id,
      mode: "instance" as const,
    })),
    ...matchingDrafts.map((draft) => ({ card, draft, key: draft.id, mode: "instance" as const })),
  ];
}

function readCardDefinition(kind: DownloadClientKind): DownloadClientCardDefinition | undefined {
  return downloadClientCards.find((card) => card.kind === kind);
}

function readDeleteConfirmationPreference(): boolean {
  return localStorage.getItem(deleteConfirmationPreferenceKey) === "true";
}

function writeDeleteConfirmationPreference(): void {
  localStorage.setItem(deleteConfirmationPreferenceKey, "true");
}
