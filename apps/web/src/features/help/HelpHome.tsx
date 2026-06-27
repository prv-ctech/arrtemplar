import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpLayout } from "./HelpLayout";
import { HelpSectionHeader } from "./HelpSection";

const helpHomeItems = [
  {
    title: "Tickets",
    description: "Requests and status.",
    action: "Open",
    to: "/help/tickets",
  },
  {
    title: "FAQ",
    description: "Saved answers.",
    action: "View",
    to: "/help/faq",
  },
] as const;

function HelpHome() {
  return (
    <section className="flex flex-col gap-4">
      <HelpSectionHeader description="Tickets and FAQ." title="Help" />
      <div className="grid gap-3 sm:grid-cols-2">
        {helpHomeItems.map((item) => (
          <Card className="rounded-2xl border-border/80 bg-card/80" key={item.title}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <Button asChild size="sm" variant="secondary">
                <Link to={item.to}>{item.action}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function HelpHomeRoute() {
  return (
    <HelpLayout activePage="home">
      <HelpHome />
    </HelpLayout>
  );
}
