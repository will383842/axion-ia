/**
 * AuditCapabilitiesMap — « Tout ce que l'IA peut apporter à votre entreprise ».
 *
 * Brief Audit 2026 §2 (Will) — carte exhaustive des capacités IA par fonction.
 * Angle conversion : le prospect doit se reconnaître en 5 secondes (« tiens, ça,
 * c'est mon problème »). Le message clé : l'IA peut faire TOUT ça, et l'AUDIT
 * détermine ce qui s'applique à VOUS et ce qui rapporte le plus vite.
 *
 * Server Component pur, zéro JS. Contenu FR canonique — EN = miroir FR
 * (locale EN désactivée / 301→FR, règle Will 2026-05-16). Les listes de
 * capacités sont rendues à l'identique quelle que soit la locale.
 */

import type { ReactNode } from "react";
import {
  Headset,
  TrendingUp,
  Megaphone,
  FileStack,
  Calculator,
  Users,
  Scale,
  Truck,
  Factory,
  LayoutDashboard,
  BrainCircuit,
  type LucideIcon,
} from "lucide-react";
import { Section } from "@/components/layout/Section";

const TIGHT_X = "lg:px-6 xl:px-10";

interface CapabilityCategory {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly items: ReadonlyArray<string>;
}

// Carte exhaustive par fonction (brief §2). FR canonique.
const CATEGORIES: ReadonlyArray<CapabilityCategory> = [
  {
    icon: Headset,
    title: "Relation & service client",
    items: [
      "Chatbot / agent conversationnel 24/7 multilingue",
      "Réponses automatiques aux emails et messages",
      "Tri et priorisation des tickets et demandes",
      "Self-service et FAQ dynamique",
      "Analyse de satisfaction (verbatims, NPS)",
      "Personnalisation et recommandations",
    ],
  },
  {
    icon: TrendingUp,
    title: "Commercial, vente & prospection",
    items: [
      "Détection et génération de leads",
      "Qualification et scoring des prospects",
      "Enrichissement CRM et relances automatiques",
      "Rédaction de devis et propositions commerciales",
      "Prévision des ventes",
      "Préparation de RDV et comptes-rendus",
    ],
  },
  {
    icon: Megaphone,
    title: "Marketing & contenu",
    items: [
      "Production de contenu (articles, posts, newsletters)",
      "SEO / AEO et visibilité dans les IA",
      "Gestion et planification des réseaux sociaux",
      "Emailing et campagnes automatisées",
      "Génération de visuels et de vidéos",
      "Analyse de performance des campagnes",
    ],
  },
  {
    icon: FileStack,
    title: "Administratif & back-office",
    items: [
      "Saisie automatique et OCR de factures/documents",
      "Rapprochements (bancaire, factures, commandes)",
      "Génération de contrats, devis et courriers",
      "Classement et extraction documentaire",
    ],
  },
  {
    icon: Calculator,
    title: "Comptabilité & finance",
    items: [
      "Relances d'impayés",
      "Prévision de trésorerie",
      "Reporting financier automatisé",
      "Détection d'anomalies et de fraude",
    ],
  },
  {
    icon: Users,
    title: "RH & recrutement",
    items: [
      "Tri et présélection de CV",
      "Réponses automatiques aux candidats",
      "Onboarding automatisé",
      "Gestion des plannings",
      "Formation interne et montée en compétences",
    ],
  },
  {
    icon: Scale,
    title: "Juridique & conformité",
    items: ["Analyse et synthèse de contrats", "Veille réglementaire", "Conformité RGPD"],
  },
  {
    icon: Truck,
    title: "Logistique, achats & opérations",
    items: [
      "Prévision de la demande",
      "Optimisation des stocks et plannings",
      "Optimisation des tournées / routage",
      "Comparaison et négociation fournisseurs",
      "Maintenance prédictive et contrôle qualité",
    ],
  },
  {
    icon: Factory,
    title: "Production & métier",
    items: ["Automatisation des tâches métier répétitives", "Aide à la décision sur le terrain"],
  },
  {
    icon: LayoutDashboard,
    title: "Données & pilotage / direction",
    items: [
      "Tableaux de bord automatisés",
      "Prévisions et aide à la décision",
      "Détection d'anomalies et d'opportunités",
      "Synthèses exécutives et comptes-rendus de réunion",
    ],
  },
  {
    icon: BrainCircuit,
    title: "Productivité & connaissance interne",
    items: [
      "Base de connaissance / assistant interne",
      "Recherche documentaire instantanée",
      "Traduction et international",
      "Synthèse de réunions et de documents",
    ],
  },
];

export interface AuditCapabilitiesMapProps {
  readonly isFr: boolean;
}

export function AuditCapabilitiesMap({ isFr }: AuditCapabilitiesMapProps): ReactNode {
  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Le champ des possibles" : "The field of possibilities"}
      title={isFr ? "Tout ce que l'IA peut" : "Everything AI can"}
      titleEm={isFr ? "apporter à votre entreprise" : "bring to your company"}
      description={
        isFr
          ? "Vous n'avez pas besoin de tout. L'audit détermine ce qui s'applique à vous — et ce qui rapporte le plus vite."
          : "You don't need all of it. The audit determines what applies to you — and what pays off fastest."
      }
      contentClassName={TIGHT_X}
    >
      <ul className="grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <li
              key={cat.title}
              className="bg-paper border-border shadow-subtle hover:border-terracotta/50 flex h-full flex-col rounded-2xl border p-6 transition-colors"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="text-fg text-[15.5px] leading-tight font-semibold tracking-tight">
                  {cat.title}
                </h3>
              </div>
              <ul className="text-fg-soft mt-1 space-y-1.5 pl-0 text-[13.5px] leading-snug">
                {cat.items.map((item) => (
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

      <p className="text-fg-muted mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed">
        {isFr
          ? "… et tout le reste. L'audit cartographie ce qui s'applique à votre cas."
          : "… and everything else. The audit maps what fits your case."}
      </p>
    </Section>
  );
}
