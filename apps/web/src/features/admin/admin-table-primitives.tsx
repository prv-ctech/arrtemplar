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
      <Table containerClassName="rounded-lg border-border/80 bg-card/50 pb-0">
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
