/**
 * AuditBenefits — « Ce qu'un audit vous apporte » : 5 bénéfices concrets en
 * cards visuelles + CTA ouvrant la popup du champ des possibles IA.
 *
 * Refonte 2026-05-31 (Will) — placé après « À qui s'adressent nos audits ? ».
 * Version courte et très visuelle (le prospect comprend au premier coup d'œil) ;
 * le détail exhaustif par fonction vit dans la popup (AuditCapabilitiesDialog).
 * Couverture sémantique SEO/AEO assurée côté serveur par la sous-ligne des
 * domaines fonctionnels (le détail de la popup se rend à l'ouverture).
 *
 * Server Component (seul morceau client = la popup importée). FR canonique —
 * EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { Compass, Target, Coins, ShieldCheck, Map as MapIcon, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { AuditCapabilitiesDialog } from "@/components/services/audit/AuditCapabilitiesDialog";

interface Benefit {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
}

const BENEFITS: ReadonlyArray<Benefit> = [
  {
    icon: Compass,
    titleFr: "Une vision claire",
    titleEn: "A clear vision",
    bodyFr:
      "Toute votre activité cartographiée : où l'IA peut vraiment changer la donne, secteur par secteur.",
    bodyEn:
      "Your whole activity mapped: where AI can truly move the needle, department by department.",
  },
  {
    icon: Target,
    titleFr: "Les bons cas d'usage",
    titleEn: "The right use cases",
    bodyFr:
      "Ce qui crée de la valeur, distingué de ce qui fait perdre du temps. Priorisé par impact.",
    bodyEn: "What creates value, told apart from what wastes time. Prioritised by impact.",
  },
  {
    icon: Coins,
    titleFr: "Des gains chiffrés",
    titleEn: "Quantified gains",
    bodyFr: "Chaque opportunité estimée en temps et en argent. Le ROI réel, pas des promesses.",
    bodyEn: "Each opportunity estimated in time and money. Real ROI, not promises.",
  },
  {
    icon: ShieldCheck,
    titleFr: "Des décisions sécurisées",
    titleEn: "Secured decisions",
    bodyFr: "Faisabilité, qualité des données, conformité AI Act : vous décidez sur du solide.",
    bodyEn: "Feasibility, data quality, AI Act compliance: you decide on solid ground.",
  },
  {
    icon: MapIcon,
    titleFr: "Une feuille de route",
    titleEn: "A roadmap",
    bodyFr: "Par quoi commencer, quand, avec quelles ressources. Prêt à exécuter, à votre rythme.",
    bodyEn: "Where to start, when, with which resources. Ready to execute, at your pace.",
  },
];

export interface AuditBenefitsProps {
  readonly isFr: boolean;
}

export function AuditBenefits({ isFr }: AuditBenefitsProps): ReactNode {
  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Ce que ça change pour vous" : "What it changes for you"}
      title={isFr ? "Ce qu'un audit vous apporte," : "What an audit gives you,"}
      titleEm={isFr ? "concrètement" : "concretely"}
      titleTail="."
      description={
        isFr
          ? "Pas un rapport qui dort dans un tiroir : une vision claire, des gains chiffrés et une feuille de route pour avancer — de la relation client à la finance, du marketing aux opérations."
          : "Not a report gathering dust: a clear vision, quantified gains and a roadmap to move forward — from customer service to finance, from marketing to operations."
      }
    >
      <ul className="grid list-none gap-5 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <li
              key={b.titleFr}
              className="bg-paper border-border shadow-subtle flex h-full flex-col rounded-2xl border p-5 text-center sm:text-left"
            >
              <span className="bg-terracotta-soft text-terracotta-deep mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl sm:mx-0">
                <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <h3 className="text-fg text-[15.5px] leading-tight font-semibold tracking-tight">
                {isFr ? b.titleFr : b.titleEn}
              </h3>
              <p className="text-fg-soft mt-2 text-[13px] leading-snug">
                {isFr ? b.bodyFr : b.bodyEn}
              </p>
            </li>
          );
        })}
      </ul>

      {/* CTA → popup du champ des possibles (tous les secteurs) */}
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <AuditCapabilitiesDialog isFr={isFr} />
        <p className="text-fg-muted text-[13px]">
          {isFr
            ? "Relation client, commercial, marketing, finance, RH, juridique, logistique, production, data… on passe chaque fonction au crible."
            : "Customer service, sales, marketing, finance, HR, legal, logistics, production, data… we comb through every function."}
        </p>
      </div>
    </Section>
  );
}
