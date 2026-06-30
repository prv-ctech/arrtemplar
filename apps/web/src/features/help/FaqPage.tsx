import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpLayout } from "./HelpLayout";
import { HelpSectionHeader } from "./HelpSection";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqCategory = {
  label: string;
  items: readonly [FaqItem, ...FaqItem[]];
};

const FAQ_CATEGORIES = [
  {
    label: "General",
    items: [
      {
        question: "What is Arrtemplar?",
        answer: "A self-hosted dashboard for managing media libraries and arr services.",
      },
      {
        question: "Which services are supported?",
        answer: "Sonarr, Radarr, Prowlarr, qBittorrent, SABnzbd, Plex, and Jellyfin.",
      },
      {
        question: "Do I need a VPN?",
        answer: "Not required, but recommended depending on your network setup.",
      },
      {
        question: "Is there a mobile app?",
        answer: "No. The web interface is responsive and works on mobile browsers.",
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        question: "How do I reset my password?",
        answer: "Use the reset link on the login page or contact an admin.",
      },
      {
        question: "Can I enable single sign-on?",
        answer: "Yes. Configure OpenID Connect under Admin → Authentication.",
      },
      {
        question: "How are API keys managed?",
        answer: "Generate and revoke keys from your profile settings.",
      },
      {
        question: "Where do I find my logs?",
        answer: "Submit a ticket from the Tickets tab, or check the server logs directory.",
      },
    ],
  },
] satisfies readonly [FaqCategory, ...FaqCategory[]];

function FaqBand({ category }: { category: FaqCategory }) {
  return (
    <div className="grid gap-4 border-t border-border pt-6 md:grid-cols-[12rem_1fr] md:gap-8">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{category.label}</h3>
      <Accordion collapsible type="single">
        {category.items.map((item) => (
          <AccordionItem key={item.question} value={item.question}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function FaqPage() {
  return (
    <section className="flex flex-col gap-6">
      <HelpSectionHeader description="Answers to common questions." title="FAQ" />
      <div className="flex flex-col gap-6">
        {FAQ_CATEGORIES.map((category) => (
          <FaqBand category={category} key={category.label} />
        ))}
      </div>
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
