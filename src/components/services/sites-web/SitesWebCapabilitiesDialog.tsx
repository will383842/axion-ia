"use client";
// use-client: Radix Dialog (popup capacités IA web) — refs/portal/focus-trap navigateur.

import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  SearchCheck,
  Sparkles,
  PencilLine,
  Workflow,
  ShoppingCart,
  ScanText,
  Languages,
  Gauge,
  ShieldCheck,
  Plug,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Capability {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly introFr: string;
  readonly introEn: string;
  readonly itemsFr: ReadonlyArray<string>;
  readonly itemsEn: ReadonlyArray<string>;
}

const CAPABILITIES: ReadonlyArray<Capability> = [
  {
    icon: Bot,
    titleFr: "Chatbots & assistants",
    titleEn: "Chatbots & assistants",
    introFr: "Conversationnel ancré sur vos données.",
    introEn: "Conversational, grounded in your data.",
    itemsFr: [
      "Chatbot RAG zéro hallucination",
      "Assistant contextuel in-app",
      "Escalade humaine",
      "Voix & multilingue",
    ],
    itemsEn: [
      "Zero-hallucination RAG chatbot",
      "Contextual in-app assistant",
      "Human escalation",
      "Voice & multilingual",
    ],
  },
  {
    icon: SearchCheck,
    titleFr: "Recherche & découvrabilité",
    titleEn: "Search & discoverability",
    introFr: "Trouver par le sens, pas par mot-clé.",
    introEn: "Find by meaning, not by keyword.",
    itemsFr: [
      "Search sémantique vectorielle",
      "Autocomplétion intelligente",
      "Filtres & facettes IA",
      "Recherche fédérée",
    ],
    itemsEn: [
      "Vector semantic search",
      "Smart autocomplete",
      "AI filters & facets",
      "Federated search",
    ],
  },
  {
    icon: Sparkles,
    titleFr: "Personnalisation",
    titleEn: "Personalisation",
    introFr: "Une expérience unique par visiteur.",
    introEn: "A unique experience per visitor.",
    itemsFr: [
      "Contenu & CTA dynamiques",
      "Recommandations",
      "Segments temps réel",
      "Sans cookie tiers",
    ],
    itemsEn: [
      "Dynamic content & CTA",
      "Recommendations",
      "Real-time segments",
      "No third-party cookie",
    ],
  },
  {
    icon: PencilLine,
    titleFr: "Génération éditoriale",
    titleEn: "Editorial generation",
    introFr: "Du contenu conforme HCU + AI Act.",
    introEn: "HCU + AI Act compliant content.",
    itemsFr: ["Blog & guides piliers", "Fiches produit", "FAQ & méta SEO", "Traductions"],
    itemsEn: ["Blog & pillar guides", "Product pages", "FAQ & SEO meta", "Translations"],
  },
  {
    icon: Workflow,
    titleFr: "Automatisations & agents",
    titleEn: "Automations & agents",
    introFr: "Des workflows qui agissent seuls.",
    introEn: "Workflows that act on their own.",
    itemsFr: [
      "Agents autonomes",
      "Automatisations métier",
      "Make, n8n, Zapier",
      "Intégrations CRM/ERP",
    ],
    itemsEn: [
      "Autonomous agents",
      "Business automations",
      "Make, n8n, Zapier",
      "CRM/ERP integrations",
    ],
  },
  {
    icon: ShoppingCart,
    titleFr: "E-commerce",
    titleEn: "E-commerce",
    introFr: "Plus de conversion, moins de friction.",
    introEn: "More conversion, less friction.",
    itemsFr: [
      "Recommandations produit",
      "Cross-sell & up-sell",
      "Descriptions auto",
      "Assistant d'achat",
    ],
    itemsEn: [
      "Product recommendations",
      "Cross-sell & up-sell",
      "Auto descriptions",
      "Shopping assistant",
    ],
  },
  {
    icon: ScanText,
    titleFr: "Vision & documents",
    titleEn: "Vision & documents",
    introFr: "Lire et structurer l'image et le PDF.",
    introEn: "Read and structure image and PDF.",
    itemsFr: [
      "OCR & extraction",
      "Classification",
      "Modération d'images",
      "Indexation documentaire",
    ],
    itemsEn: ["OCR & extraction", "Classification", "Image moderation", "Document indexing"],
  },
  {
    icon: Languages,
    titleFr: "Multilingue & international",
    titleEn: "Multilingual & international",
    introFr: "Un site qui parle à chaque marché.",
    introEn: "A site that speaks to each market.",
    itemsFr: ["Traduction IA", "Contenu localisé", "hreflang propre", "Détection de langue"],
    itemsEn: ["AI translation", "Localised content", "Clean hreflang", "Language detection"],
  },
  {
    icon: Gauge,
    titleFr: "Performance & SEO/AEO",
    titleEn: "Performance & SEO/AEO",
    introFr: "Visible des moteurs et des LLM.",
    introEn: "Visible to engines and LLMs.",
    itemsFr: [
      "Web Vitals au cordeau",
      "JSON-LD & schema",
      "AI Overviews & GEO",
      "Citabilité Perplexity/Claude",
    ],
    itemsEn: [
      "Tight Web Vitals",
      "JSON-LD & schema",
      "AI Overviews & GEO",
      "Perplexity/Claude citability",
    ],
  },
  {
    icon: Plug,
    titleFr: "Intégrations & API",
    titleEn: "Integrations & API",
    introFr: "On se branche sur votre existant.",
    introEn: "We plug into what you have.",
    itemsFr: [
      "Claude, OpenAI, Mistral",
      "Webhooks & API REST/GraphQL",
      "Widget JS ou plugin",
      "Toute stack",
    ],
    itemsEn: [
      "Claude, OpenAI, Mistral",
      "Webhooks & REST/GraphQL API",
      "JS widget or plugin",
      "Any stack",
    ],
  },
  {
    icon: BarChart3,
    titleFr: "Analytics & pilotage",
    titleEn: "Analytics & steering",
    introFr: "Comprendre pour décider.",
    introEn: "Understand to decide.",
    itemsFr: [
      "Insights conversationnels",
      "Scoring & intentions",
      "Tableaux de bord",
      "A/B testing IA",
    ],
    itemsEn: ["Conversational insights", "Scoring & intent", "Dashboards", "AI A/B testing"],
  },
  {
    icon: ShieldCheck,
    titleFr: "Conformité & confiance",
    titleEn: "Compliance & trust",
    introFr: "Vos données, vos règles.",
    introEn: "Your data, your rules.",
    itemsFr: [
      "RGPD natif · hébergement UE",
      "Garde-fous & filtrage",
      "Logs & traçabilité",
      "Propriété du code",
    ],
    itemsEn: [
      "GDPR native · EU hosting",
      "Guardrails & filtering",
      "Logs & traceability",
      "Code ownership",
    ],
  },
];

export interface SitesWebCapabilitiesDialogProps {
  readonly isFr: boolean;
}

export function SitesWebCapabilitiesDialog({ isFr }: SitesWebCapabilitiesDialogProps): ReactNode {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="terracotta" size="lg" shape="pill" data-cta="sites-web-capabilities-open">
          {isFr
            ? "Voir tout ce que l'IA peut faire sur votre site"
            : "See everything AI can do on your site"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl overflow-hidden rounded-2xl p-0">
        <div className="max-h-[88vh] overflow-y-auto p-6 sm:p-8">
          <div className="pr-10">
            <p className="text-terracotta-deep mb-2 text-[12px] font-bold tracking-[0.18em] uppercase">
              {isFr ? "Le champ des possibles" : "The field of possibilities"}
            </p>
            <DialogTitle
              className="text-fg text-[clamp(1.5rem,3.5vw,2.25rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Tout ce que l'IA peut " : "Everything AI can "}
              <span className="text-terracotta italic">
                {isFr ? "faire sur votre site" : "do on your site"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-fg-soft mt-2 text-[14.5px] leading-relaxed">
              {isFr
                ? "Du site vitrine à la plateforme SaaS B2B : l'IA s'intègre partout, sur une nouvelle base ou votre existant. Vous n'avez pas besoin de tout — on cadre ensemble les briques à plus fort ROI selon votre priorité."
                : "From showcase site to B2B SaaS platform: AI fits everywhere, on a new base or your existing one. You don't need all of it — together we scope the highest-ROI bricks for your priority."}
            </DialogDescription>
          </div>

          <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((domain) => {
              const Icon = domain.icon;
              return (
                <li
                  key={domain.titleFr}
                  className="bg-paper border-border flex h-full flex-col rounded-2xl border p-5"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                      <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <h3 className="text-fg text-[15px] leading-tight font-semibold tracking-tight">
                      {isFr ? domain.titleFr : domain.titleEn}
                    </h3>
                  </div>
                  <p className="text-terracotta-deep mb-3 text-[13px] leading-snug font-medium">
                    {isFr ? domain.introFr : domain.introEn}
                  </p>
                  <ul className="text-fg-soft space-y-1.5 p-0 text-[13px] leading-snug">
                    {(isFr ? domain.itemsFr : domain.itemsEn).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="text-terracotta mt-[3px] leading-none">
                          ·
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>

          <p className="text-fg-muted mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed">
            {isFr
              ? "… et tout le reste. On cartographie précisément ce qui s'applique à votre site, et on le chiffre en 48 h."
              : "… and everything else. We map exactly what fits your site, and cost it within 48 h."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
