import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HelpSectionHeader({ description, title }: { description: string; title: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function HelpEmptyStateCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Card className="rounded-2xl border-dashed bg-card/70">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-1 text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}
