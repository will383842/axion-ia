// Server Component — bloc « extras » commun aux pages détail formation
// collective (/interventions/{essentielle,approfondie,gagner-du-temps,
// intervention-claude}). Calqué sur ImplementationSubPageExtras, sans toucher au
// ProductPageTemplate partagé. Mutualise le maillage de pied de page :
//   1. Pages suggérées (3 formations sœurs distinctes + cross-link audit)
//   2. Couverture nationale (LocalCoverageSection) → visibilité villes / pSEO
//   3. Connaissances liées (RelatedKnowledge, masqué si vide)
//
// La FAQ reste rendue par ProductPageTemplate (pas de hideFaq ici) → on
// n'ajoute QUE le maillage, sans restructurer les pages déjà validées.
// AUCUN prix (les tarifs restent dans pricing.ts, affichés par les pages).

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Link } from "@/i18n/navigation";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { QualiopiPublicFormationInfo } from "@/components/qualiopi/QualiopiPublicFormationInfo";
import { buildHowToJsonLd, buildCourseJsonLd } from "@/lib/seo";
import { getIntervention } from "@/content/interventions";
import {
  FORMATION_RELATED,
  FORMATION_GEO_LABEL,
  FORMATION_DURATION_ISO,
  type FormationDetailSlug,
} from "@/content/interventions-subpages";

/**
 * slug fiche formation collective → tierId de l'offre Qualiopi (cf. intervention-path-map).
 * Partial : seules les fiches rattachées à une offre affichent le bloc conformité.
 */
const FORMATION_SLUG_TO_OFFRE_TIER: Partial<Record<FormationDetailSlug, string>> = {
  essentielle: "intervention-essentielle",
  approfondie: "intervention-approfondie",
  "gagner-du-temps": "intervention-temps",
  "intervention-claude": "intervention-claude",
};

/** Construit un libellé propre depuis le titre éclaté (title + titleEm + tail). */
function fullTitle(copy: { title: string; titleEm?: string; titleTail?: string }): string {
  return [copy.title, copy.titleEm, copy.titleTail]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function FormationSubPageExtras({
  isFr,
  slug,
}: {
  isFr: boolean;
  slug: FormationDetailSlug;
}): ReactNode {
  const geo = FORMATION_GEO_LABEL[slug];
  const offreTier = FORMATION_SLUG_TO_OFFRE_TIER[slug];

  // HowTo JSON-LD — signal AEO « comment se déroule cette formation » dérivé du
  // programme de la journée (daySchedule, distinct par formation → pas de
  // duplicate, contrairement aux étapes de réservation génériques). Aligne les
  // pages détail formation sur le standard /implementation. Omis si pas de
  // programme (dégradation propre).
  const self = getIntervention(slug);
  const copy = isFr ? self.fr : self.en;
  const locale = isFr ? "fr" : "en";
  const path = isFr ? self.pathFr : self.pathEn;
  const scheduleItems = (copy.daySchedule?.days ?? []).flatMap((d) => d.items);
  const howToJsonLd =
    scheduleItems.length > 0
      ? buildHowToJsonLd({
          locale,
          path,
          name: isFr
            ? `Comment se déroule ${copy.title.toLowerCase()}`
            : `How ${copy.title.toLowerCase()} unfolds`,
          description: copy.answer,
          steps: scheduleItems.map((it) => ({
            name: it.title,
            text: it.description ?? it.title,
          })),
        })
      : null;

  // Course JSON-LD — chaque formation détail est un cours (signal AEO/LLM
  // « formation X »). Le hub /interventions/collectives liste déjà les Courses
  // par durée ; ici on émet le Course spécifique à la page. Durée ISO 8601 par
  // format. priceEurHt dérivé de la SSOT (copy.priceEur, jamais hardcodé).
  const courseJsonLd = buildCourseJsonLd({
    locale,
    path,
    name: copy.title,
    description: copy.answer,
    courseMode: ["Onsite"],
    duration: FORMATION_DURATION_ISO[slug],
    audienceType: isFr
      ? "Équipes, dirigeants et collaborateurs opérationnels (TPE, PME, ETI)"
      : "Teams, executives and operational staff (small businesses, SMEs, mid-caps)",
    ...(copy.priceEur ? { priceEurHt: copy.priceEur } : {}),
    about: isFr ? "IA opérationnelle" : "Operational AI",
  });

  // 3 formations sœurs (distinctes par page) + 1 cross-link audit (funnel amont).
  const siblings = FORMATION_RELATED[slug].map((rs) => {
    const r = getIntervention(rs);
    const rc = isFr ? r.fr : r.en;
    return {
      href: isFr ? r.pathFr : r.pathEn,
      label: fullTitle(rc),
      description: rc.answer,
    };
  });
  const cards = [
    ...siblings,
    {
      href: "/audit",
      label: isFr ? "Commencer par un audit IA" : "Start with an AI audit",
      description: isFr
        ? "Cadrer les bons usages et le ROI avant de former, sans engagement sur la suite."
        : "Frame the right uses and ROI before training, with no commitment on what follows.",
    },
  ];

  return (
    <>
      {howToJsonLd ? <JsonLd data={howToJsonLd} /> : null}
      <JsonLd data={courseJsonLd} />

      {/* Pages suggérées — maillage interne « Voir aussi » (4 cartes distinctes) */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Autres formations" : "Other trainings"}
        title={isFr ? "Pour aller" : "Go"}
        titleEm={isFr ? "plus loin" : "further"}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href as never}
              className="border-border bg-bg hover:border-terracotta hover:shadow-card focus-visible:ring-terracotta flex h-full flex-col rounded-2xl border p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <p className="text-fg text-[15px] leading-snug font-semibold">{c.label}</p>
              <p className="text-fg-soft mt-2 line-clamp-2 flex-1 text-sm leading-relaxed">
                {c.description}
              </p>
              <span className="text-terracotta-deep mt-4 inline-flex items-center gap-1 text-[13px] font-medium">
                {isFr ? "Découvrir" : "Discover"}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* Couverture nationale — visibilité villes / pSEO (sujet exact de la page) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr={geo.fr}
        serviceLabelEn={geo.en}
        serviceSlug="interventions"
        tone="sand"
      />

      {/* Connaissances liées — KB Service Binding (masqué si vide / stub build) */}
      <RelatedKnowledge service="interventions-formations" />

      {/* Infos réglementaires Qualiopi (indicateur 1) — alimenté par la formation
          publiée rattachée à l'offre ; rendu null en Phase A / sans formation. */}
      {offreTier ? <QualiopiPublicFormationInfo tier={offreTier} /> : null}
    </>
  );
}
