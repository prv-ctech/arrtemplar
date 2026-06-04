import { type ReactNode, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { SettingsTabs, SettingsTabsList, SettingsTabsTrigger } from "./SettingsPrimitives";

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
  const scrollStateKey = `${label}:${entries.map((entry) => entry.id).join("|")}`;

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

  function handleSelect(nextValue: string) {
    persistScrollPosition();
    const entry = entries.find((candidate) => candidate.id === nextValue);

    if (entry) {
      onSelect(entry.id);
    }
  }

  return (
    <nav aria-label={label} className="relative z-10 w-full">
      <div
        className="scrollbar-hidden relative z-10 overflow-x-auto overscroll-x-contain py-1 pr-4 pl-0 scroll-px-4 touch-pan-x snap-x"
        onScroll={persistScrollPosition}
        ref={tablistRef}
      >
        <SettingsTabs
          activationMode="automatic"
          className="w-max min-w-full"
          onValueChange={handleSelect}
          value={active}
        >
          <SettingsTabsList
            aria-label={`${label} categories`}
            className="h-auto w-max min-w-max gap-1 rounded-2xl border border-border/70 bg-card/70 p-1 backdrop-blur-sm"
          >
            {entries.map((entry) => {
              const isActive = active === entry.id;

              return (
                <SettingsTabsTrigger
                  aria-controls={`${entry.id}-settings-panel`}
                  className={cn(
                    "h-auto min-h-11 shrink-0 snap-start justify-start gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap touch-manipulation",
                    "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",
                    "data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                    "**:data-[slot=settings-nav-icon]:transition-colors data-[state=active]:**:data-[slot=settings-nav-icon]:text-primary",
                  )}
                  id={`${entry.id}-settings-tab`}
                  key={entry.id}
                  value={entry.id}
                >
                  <span
                    data-slot="settings-nav-icon"
                    className={isActive ? "text-primary" : undefined}
                  >
                    {entry.icon}
                  </span>
                  <span className="min-w-0 truncate">{entry.label}</span>
                </SettingsTabsTrigger>
              );
            })}
          </SettingsTabsList>
        </SettingsTabs>
      </div>
    </nav>
  );
}
