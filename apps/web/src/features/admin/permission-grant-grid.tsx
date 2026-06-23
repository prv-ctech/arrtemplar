import type { PermissionCatalogEntry, UserPermission } from "@arrtemplar/shared";

const permissionCategoryOrder: readonly PermissionCatalogEntry["category"][] = [
  "system",
  "users",
  "profile",
  "settings",
];

export const permissionsDialogContentClassName = [
  "grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl",
  "grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 overflow-hidden",
  "p-4 sm:w-[calc(100vw-2rem)] sm:p-5 lg:w-[calc(100vw-4rem)]",
].join(" ");

const permissionRowClassName = [
  "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto]",
  "items-center gap-2 py-2 first:pt-0 last:pb-0",
].join(" ");

type PermissionGroups = Map<PermissionCatalogEntry["category"], PermissionCatalogEntry[]>;

export function PermissionCategoryGrid({
  entries,
  onTogglePermission,
  selectedPermissions,
}: {
  entries: readonly PermissionCatalogEntry[];
  onTogglePermission: (permission: UserPermission) => void;
  selectedPermissions: ReadonlySet<UserPermission>;
}) {
  const permissionGroups = groupPermissionEntries(entries);

  return (
    <fieldset className="min-h-0 overflow-y-auto overscroll-contain pr-1">
      <legend className="sr-only">Available permission grants</legend>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {permissionCategoryOrder.map((category) => (
          <PermissionCategorySection
            category={category}
            entries={permissionGroups.get(category) ?? []}
            key={category}
            onTogglePermission={onTogglePermission}
            selectedPermissions={selectedPermissions}
          />
        ))}
      </div>
    </fieldset>
  );
}

function groupPermissionEntries(entries: readonly PermissionCatalogEntry[]): PermissionGroups {
  const permissionGroups = new Map<PermissionCatalogEntry["category"], PermissionCatalogEntry[]>();

  for (const entry of entries) {
    permissionGroups.set(entry.category, [...(permissionGroups.get(entry.category) ?? []), entry]);
  }

  return permissionGroups;
}

function PermissionCategorySection({
  category,
  entries,
  onTogglePermission,
  selectedPermissions,
}: {
  category: PermissionCatalogEntry["category"];
  entries: PermissionCatalogEntry[];
  onTogglePermission: (permission: UserPermission) => void;
  selectedPermissions: ReadonlySet<UserPermission>;
}) {
  if (!entries.length) {
    return null;
  }

  return (
    <section
      aria-labelledby={`permission-category-${category}`}
      className="min-w-0 rounded-xl border border-border bg-card/35 p-3"
    >
      <PermissionCategoryHeader category={category} count={entries.length} />
      <div className="divide-y divide-border/70">
        {entries.map((entry) => (
          <PermissionRow
            checked={selectedPermissions.has(entry.permission)}
            entry={entry}
            key={entry.permission}
            onTogglePermission={onTogglePermission}
          />
        ))}
      </div>
    </section>
  );
}

function PermissionCategoryHeader({
  category,
  count,
}: {
  category: PermissionCatalogEntry["category"];
  count: number;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3
        className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        id={`permission-category-${category}`}
      >
        {category}
      </h3>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

function PermissionRow({
  checked,
  entry,
  onTogglePermission,
}: {
  checked: boolean;
  entry: PermissionCatalogEntry;
  onTogglePermission: (permission: UserPermission) => void;
}) {
  const highRisk = entry.risk === "critical" || entry.risk === "high";

  return (
    <label className={permissionRowClassName} title={entry.description}>
      <input
        checked={checked}
        className="size-4 accent-primary"
        onChange={() => onTogglePermission(entry.permission)}
        type="checkbox"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{entry.label}</span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {entry.permission}
        </span>
      </span>
      {highRisk ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600">
          High risk
        </span>
      ) : null}
    </label>
  );
}
