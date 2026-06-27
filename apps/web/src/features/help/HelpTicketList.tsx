import type { HelpTicketSummary } from "@arrtemplar/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HelpTicketStatusBadge } from "./help-ticket-status-badge";

export function HelpTicketList({
  canManage,
  onOpen,
  tickets,
}: {
  canManage: boolean;
  onOpen: (ticketId: string) => void;
  tickets: HelpTicketSummary[];
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              {canManage ? <TableHead>Reporter</TableHead> : null}
              <TableHead>Status</TableHead>
              <TableHead>Files</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>
                  <button
                    className="min-w-0 text-left text-sm font-medium text-foreground hover:text-primary"
                    onClick={() => onOpen(ticket.id)}
                    type="button"
                  >
                    <span className="block truncate">{ticket.title}</span>
                  </button>
                </TableCell>
                {canManage ? <TableCell>{ticket.createdBy.username}</TableCell> : null}
                <TableCell>
                  <HelpTicketStatusBadge status={ticket.status} />
                </TableCell>
                <TableCell>{ticket.attachmentCount}</TableCell>
                <TableCell>{formatTicketDate(ticket.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    onClick={() => onOpen(ticket.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 md:hidden">
        {tickets.map((ticket) => (
          <Card className="rounded-2xl border-border/80 bg-card/80" key={ticket.id}>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{ticket.title}</CardTitle>
                  <CardDescription>
                    {canManage ? ticket.createdBy.username : formatTicketDate(ticket.updatedAt)}
                  </CardDescription>
                </div>
                <HelpTicketStatusBadge status={ticket.status} />
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3 p-4 pt-1">
              <span className="text-sm text-muted-foreground">
                {ticket.attachmentCount} file(s)
              </span>
              <Button onClick={() => onOpen(ticket.id)} size="sm" type="button" variant="secondary">
                Open
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function formatTicketDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
