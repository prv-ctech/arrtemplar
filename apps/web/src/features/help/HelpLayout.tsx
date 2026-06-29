import { InfoIcon, ScrollIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import { SettingsPanel } from "../settings/SettingsPrimitives";

export type HelpPage = "tickets" | "faq";

type HelpRouteTarget = "/help/tickets" | "/help/faq";

type HelpEntry = SettingsEntry<HelpPage> & {
  to: HelpRouteTarget;
};

const helpEntries: readonly [HelpEntry, ...HelpEntry[]] = [
  {
    id: "faq",
    label: "FAQ",
    icon: <InfoIcon aria-hidden="true" className="size-5" />,
    to: "/help/faq",
  },
  {
    id: "tickets",
    label: "Tickets",
    icon: <ScrollIcon aria-hidden="true" className="size-5" />,
    to: "/help/tickets",
  },
];

export function HelpLayout({
  activePage,
  children,
}: {
  activePage: HelpPage;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  function handlePageChange(page: HelpPage) {
    const entry = helpEntries.find((currentEntry) => currentEntry.id === page);

    if (entry) {
      navigate({ replace: true, to: entry.to });
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Help</h1>
      <SettingsNav
        active={activePage}
        entries={helpEntries}
        label="Help"
        onSelect={handlePageChange}
      />
      <SettingsPanel activeId={activePage}>{children}</SettingsPanel>
    </div>
  );
}
