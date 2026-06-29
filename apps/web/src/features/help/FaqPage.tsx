import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpLayout } from "./HelpLayout";
import { HelpSectionHeader } from "./HelpSection";

function FaqPage() {
  return (
    <section className="flex flex-col gap-4">
      <HelpSectionHeader description="Saved answers." title="FAQ" />
      <Card className="rounded-2xl border-dashed bg-card/70">
        <CardHeader className="p-4">
          <CardTitle className="text-base">FAQ</CardTitle>
          <CardDescription>Empty.</CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}

export function HelpFaqRoute() {
  return (
    <HelpLayout activePage="faq">
      <FaqPage />
    </HelpLayout>
  );
}
