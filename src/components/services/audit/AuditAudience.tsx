/**
 * AuditAudience — « À qui s'adressent les audits » : 3 cards par taille
 * d'entreprise (Server Component).
 *
 * Refonte 2026-05-31 (Will) — 3 cards sur une ligne : TPE/artisans-commerçants,
 * PME, ETI & grandes entreprises. Message : un audit DÉTAILLÉ et complet de
 * l'entreprise (pas « 1-2 automatisations »). Tout en présentiel. TPE = audit
 * complet de l'entreprise en une journée sur place ; PME / ETI / grandes
 * entreprises = sur devis. Aucun prix en prose (price-gate OK).
 *
 * Zéro JS. FR canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import { Store, Building, Building2, ArrowRight, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";

interface AudienceCard {
  readonly icon: LucideIcon;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly badgeFr: string;
  readonly badgeEn: string;
  readonly descFr: string;
  readonly descEn: string;
  readonly ctaHref: string;
  readonly ctaFr: string;
  readonly ctaEn: string;
  readonly track: string;
}

const CARDS: ReadonlyArray<AudienceCard> = [
  {
    icon: Store,
    labelFr: "TPE, artisans & commerçants",
    labelEn: "Small businesses, artisans & retailers",
    badgeFr: "1 journée complète · sur place",
    badgeEn: "1 full day · on site",
    descFr:
      "On audite votre entreprise de fond en comble, en une journée complète sur place. On cartographie chaque activité pour révéler tout ce que l'IA peut y changer — concret, sans jargon, prêt à exécuter.",
    descEn:
      "We audit your whole business in depth, in one full day on site. We map every activity to reveal everything AI can change — concrete, jargon-free, ready to execute.",
    ctaHref: "/appel",
    ctaFr: "Réserver l'audit",
    ctaEn: "Book the audit",
    track: "audit_audience_tpe",
  },
  {
    icon: Building,
    labelFr: "PME",
    labelEn: "SME",
    badgeFr: "Sur devis",
    badgeEn: "On quote",
    descFr:
      "Audit détaillé de toute l'organisation, service par service. On cartographie chaque process et on chiffre les opportunités IA, des quick wins aux chantiers structurants.",
    descEn:
      "A detailed audit of the whole organisation, department by department. We map every process and cost the AI opportunities, from quick wins to structural projects.",
    ctaHref: "/contact",
    ctaFr: "Demander un devis",
    ctaEn: "Request a quote",
    track: "audit_audience_pme",
  },
  {
    icon: Building2,
    labelFr: "ETI & grandes entreprises",
    labelEn: "Mid-caps & large enterprises",
    badgeFr: "Sur devis",
    badgeEn: "On quote",
    descFr:
      "Audit transverse multi-sites et multi-métiers, gouvernance IA conforme à l'AI Act et livrables prêts pour le board. Calibré à l'échelle de votre groupe.",
    descEn:
      "A transverse, multi-site and multi-business audit, AI Act-compliant governance and board-ready deliverables. Calibrated to your group's scale.",
    ctaHref: "/contact",
    ctaFr: "Demander un devis",
    ctaEn: "Request a quote",
    track: "audit_audience_eti",
  },
];

export interface AuditAudienceProps {
  readonly isFr: boolean;
}

export function AuditAudience({ isFr }: AuditAudienceProps): ReactNode {
  return (
    <Section
      tone="canvas"
      eyebrow={isFr ? "À qui ça s'adresse" : "Who it's for"}
      title={isFr ? "Un audit complet, quelle que soit" : "A complete audit, whatever"}
      titleEm={isFr ? "votre taille" : "your size"}
      titleTail="."
      description={
        isFr
          ? "Quelle que soit votre taille, on audite votre entreprise en détail — tout en présentiel. On vient chez vous, on observe le réel, on repart avec un plan."
          : "Whatever your size, we audit your company in detail — fully on site. We come to you, observe the reality, and leave with a plan."
      }
    >
      <ul className="grid list-none gap-6 p-0 md:grid-cols-3">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.track} className="h-full">
              <article className="group border-border bg-paper shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full flex-col overflow-hidden rounded-3xl border transition">
                {/* Liseré d'accent en tête */}
                <span aria-hidden="true" className="bg-terracotta block h-1.5 w-full" />
                <div className="flex flex-1 flex-col p-7">
                  <span className="bg-terracotta-soft text-terracotta-deep mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
                    <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={1.75} />
                  </span>
                  <h3 className="text-fg text-xl leading-snug font-semibold tracking-tight">
                    {isFr ? c.labelFr : c.labelEn}
                  </h3>
                  <span className="border-terracotta/30 bg-terracotta-soft/40 text-terracotta-deep mt-3 inline-flex w-fit items-center rounded-full border px-3 py-1 text-[12px] font-semibold">
                    {isFr ? c.badgeFr : c.badgeEn}
                  </span>
                  <p className="text-fg-soft mt-4 flex-1 text-[14.5px] leading-relaxed">
                    {isFr ? c.descFr : c.descEn}
                  </p>
                  <Cta
                    href={c.ctaHref}
                    variant="terracotta"
                    shape="pill"
                    className="mt-6 w-fit"
                    track={c.track}
                  >
                    {isFr ? c.ctaFr : c.ctaEn}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Cta>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
