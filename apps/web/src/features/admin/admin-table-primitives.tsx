import { CaretRightIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type AdminTableColumn = {
  align?: "left" | "right";
  label: string;
};

export function AdminDesktopTable({
  children,
  columns,
}: {
  children: ReactNode;
  columns: readonly AdminTableColumn[];
}) {
  return (
    <div className="hidden md:block">
      <Table containerClassName="rounded-lg border-border/90 bg-card/72 pb-0">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                className={cn("h-8 px-3 text-xs", column.align === "right" && "text-right")}
                key={column.label}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export function ExpandableTableTitleButton({
  children,
  expanded,
  onToggle,
}: {
  children: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-expanded={expanded}
      className="group flex min-w-0 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      type="button"
    >
      <CaretRightIcon
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-transform",
          expanded && "rotate-90",
        )}
      />
      {children}
    </button>
  );
}
