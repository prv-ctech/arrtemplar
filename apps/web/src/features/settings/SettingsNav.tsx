import { type KeyboardEvent, type ReactNode, useLayoutEffect, useMemo, useRef } from "react";

const settingsNavScrollLeftByKey = new Map<string, number>();

export type SettingsEntry<TPage extends string = string> = {
  id: TPage;
  label: string;
  icon: ReactNode;
  description: string;
};

export function SettingsNav<TPage extends string>({
  active,
  entries,
  label,
  onSelect,
}: {
  entries: readonly SettingsEntry<TPage>[];
  active: TPage;
  label: string;
  onSelect: (id: TPage) => void;
}) {
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const scrollStateKey = useMemo(
    () => `${label}:${entries.map((entry) => entry.id).join("|")}`,
    [entries, label],
  );

  useLayoutEffect(() => {
    const tablist = tablistRef.current;

    if (!tablist) {
      return;
    }

    const savedScrollLeft = settingsNavScrollLeftByKey.get(scrollStateKey);

    if (savedScrollLeft === undefined) {
      return;
    }

    tablist.scrollLeft = savedScrollLeft;
  }, [scrollStateKey, active]);

  function persistScrollPosition() {
    const tablist = tablistRef.current;

    if (!tablist) {
      return;
    }

    settingsNavScrollLeftByKey.set(scrollStateKey, tablist.scrollLeft);
  }

  function selectAndFocus(entry: SettingsEntry<TPage>) {
    persistScrollPosition();
    onSelect(entry.id);
    document.getElementById(`${entry.id}-settings-tab`)?.focus();
  }

  function handleScroll() {
    persistScrollPosition();
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
    <nav aria-label={label} className="relative z-10 w-full bg-background/95 backdrop-blur-sm">
      <div
        aria-label="Settings categories"
        className="scrollbar-hidden relative z-10 flex gap-0 overflow-x-auto overscroll-x-contain border-b border-border pr-4 pl-0 scroll-px-4 touch-pan-x snap-x"
        onScroll={handleScroll}
        ref={tablistRef}
        role="tablist"
      >
        {entries.map((entry, index) => {
          const isActive = active === entry.id;
          return (
            <button
              aria-controls={`${entry.id}-settings-panel`}
              aria-selected={isActive}
              className={[
                "relative flex min-h-11 shrink-0 snap-start items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-300 touch-manipulation",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
              id={`${entry.id}-settings-tab`}
              key={entry.id}
              onClick={() => {
                persistScrollPosition();
                onSelect(entry.id);
              }}
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
