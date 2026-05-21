import type { KeyboardEvent, ReactNode } from "react";

export type SettingsPage =
  | "general"
  | "library"
  | "users"
  | "import"
  | "notifications"
  | "services"
  | "logs"
  | "about";

export type SettingsEntry = {
  id: SettingsPage;
  label: string;
  icon: ReactNode;
  description: string;
};

export function SettingsNav({
  entries,
  active,
  onSelect,
}: {
  entries: SettingsEntry[];
  active: SettingsPage;
  onSelect: (id: SettingsPage) => void;
}) {
  function selectAndFocus(entry: SettingsEntry) {
    onSelect(entry.id);
    document.getElementById(`${entry.id}-settings-tab`)?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = entries.length - 1;
    const nextIndexByKey: Record<string, number> = {
      ArrowDown: index === lastIndex ? 0 : index + 1,
      ArrowRight: index === lastIndex ? 0 : index + 1,
      ArrowUp: index === 0 ? lastIndex : index - 1,
      ArrowLeft: index === 0 ? lastIndex : index - 1,
      End: lastIndex,
      Home: 0,
    };
    const nextIndex = nextIndexByKey[event.key];
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextEntry = entries[nextIndex];
    if (nextEntry) selectAndFocus(nextEntry);
  }

  return (
    <nav aria-label="Admin settings" className="w-full">
      <div
        aria-label="Settings categories"
        className="scrollbar-hidden flex gap-0 overflow-x-auto border-b border-border"
        role="tablist"
      >
        {entries.map((entry, index) => {
          const isActive = active === entry.id;
          return (
            <button
              aria-controls={`${entry.id}-settings-panel`}
              aria-selected={isActive}
              className={[
                "relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-300",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
              id={`${entry.id}-settings-tab`}
              key={entry.id}
              onClick={() => onSelect(entry.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span className={isActive ? "text-primary" : ""}>{entry.icon}</span>
              <span className="min-w-0 truncate">{entry.label}</span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-1/4 right-1/4 h-0.5 -translate-y-px rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
