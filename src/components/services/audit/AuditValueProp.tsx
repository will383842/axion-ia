/**
 * AuditValueProp — bloc value-proposition placé juste sous le hero /audit.
 *
 * Refonte 2026-05-31 (Will) — affirmation forte et orientée bénéfice, avant
 * la narration (pourquoi maintenant → démarche → livrable → capacités). On
 * remplace l'ancien inventaire fourre-tout de buzzwords par une promesse
 * simple et lisible en 2 secondes par un dirigeant TPE/PME : faire auditer
 * son entreprise pour révéler tout ce que l'IA peut réellement lui apporter.
 *
 * Server Component pur, zéro JS (budget Web Vitals). FR canonique — EN =
 * miroir (locale EN désactivée / 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { ArrowRight, Compass, Gauge, ShieldCheck, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";

interface Pillar {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly sub: string;
}

export interface AuditValuePropProps {
  readonly isFr: boolean;
}

export function AuditValueProp({ isFr }: AuditValuePropProps): ReactNode {
  const pillars: ReadonlyArray<Pillar> = [
    {
      icon: Compass,
      label: isFr ? "Un regard neutre" : "A neutral view",
      sub: isFr
        ? "Conseil indépendant — on ne vous vend pas une techno."
        : "Independent advice — no tech to sell you.",
    },
    {
      icon: Gauge,
      label: isFr ? "Ce qui rapporte vite" : "What pays off fast",
      sub: isFr
        ? "Vos opportunités classées par ROI réel."
        : "Your opportunities ranked by real ROI.",
    },
    {
      icon: ShieldCheck,
      label: isFr ? "Sans engagement" : "No commitment",
      sub: isFr
        ? "Vous repartez avec le plan, libre de l'exécuter."
        : "You leave with the plan, free to run it.",
    },
  ];

  return (
    <Section
      tone="halo-warm"
      eyebrow={isFr ? "Le déclic" : "The trigger"}
      title={
        isFr ? "Faites auditer votre entreprise et révélez" : "Have your company audited and reveal"
      }
      titleEm={
        isFr
          ? "tout ce que l'IA peut réellement vous apporter"
          : "everything AI can truly bring you"
      }
      titleTail="."
      description={
        isFr
          ? "Pas un catalogue de buzzwords : un diagnostic clair et neutre de votre activité, qui révèle — preuve à l'appui — où l'IA vous fait vraiment gagner du temps et de l'argent."
          : "Not a buzzword catalogue: a clear, neutral diagnosis of your business that reveals — with evidence — where AI genuinely saves you time and money."
      }
    >
      <ul className="grid list-none gap-5 p-0 sm:grid-cols-3 lg:gap-6">
        {pillars.map((p) => {
          const Icon = p.icon;
          return (
            <li
              key={p.label}
              className="bg-paper border-border shadow-subtle flex items-start gap-3 rounded-2xl border p-5"
            >
              <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-fg text-[15px] leading-tight font-semibold">{p.label}</p>
                <p className="text-fg-soft mt-1 text-[13px] leading-snug">{p.sub}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Cta
          href="/appel"
          size="lg"
          variant="terracotta"
          shape="pill"
          track="audit-valueprop-book-call"
        >
          {isFr ? "Réserver un appel découverte" : "Book a discovery call"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Cta>
        <span className="text-fg-muted text-[13px]">
          {isFr ? "30 min · gratuit · sans engagement" : "30 min · free · no commitment"}
        </span>
      </div>
    </Section>
  );
}
