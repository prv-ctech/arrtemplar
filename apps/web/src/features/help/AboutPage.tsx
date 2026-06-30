import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpLayout } from "./HelpLayout";
import { HelpSectionHeader } from "./HelpSection";

function AboutPage() {
  return (
    <section className="flex flex-col gap-4">
      <HelpSectionHeader description="App version and details." title="About" />
      <Card className="rounded-2xl bg-card/70">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Arrtemplar</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 text-sm text-muted-foreground">
          v0.1.0 — self-hosted media library dashboard.
        </CardContent>
      </Card>
    </section>
  );
}

export function HelpAboutRoute() {
  return (
    <HelpLayout activePage="about">
      <AboutPage />
    </HelpLayout>
  );
}
