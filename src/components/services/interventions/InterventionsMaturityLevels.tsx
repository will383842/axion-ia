/**
 * InterventionsMaturityLevels — 3 niveaux maturité IA + recos famille.
 *
 * Sprint A Phase 2 (2026-05-25). Server Component. Réutilisé hub + pages ville.
 * Niveau 1 (débutant) → Collectives ; Niveau 2 (en cours) → Individuel ;
 * Niveau 3 (équipe fluide) → Dirigeants. Pricing 4h + essentielle dérivés
 * pricing.ts pour éviter le drift.
 *
 * Si villeContext fourni : `data-source-ville` propagé sur les 3 liens reco.
 */

import { Link } from "@/i18n/navigation";
import { Section } from "@/components/layout/Section";
import { INTERVENTION_TIERS, formatAmount, getTierById } from "@/content/pricing";
import type { VilleContext } from "@/components/services/types";

interface InterventionsMaturityLevelsProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export function InterventionsMaturityLevels({
  isFr,
  villeContext,
}: InterventionsMaturityLevelsProps) {
  const villeAttr = villeContext ? { "data-source-ville": villeContext.villeSlug } : {};

  const essentielleEntryAmount = getTierById(
    INTERVENTION_TIERS,
    "intervention-essentielle",
  ).priceFlat!;
  const fourHEntryAmount = getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!;

  const cards = [
    {
      level: isFr ? "Niveau 1" : "Stage 1",
      title: isFr
        ? "Personne n'a encore utilisé l'IA dans l'équipe"
        : "No one on the team uses AI yet",
      body: isFr
        ? `Démarrage rapide en 4 heures (${formatAmount(fourHEntryAmount, "fr", { compact: true })}) ou 1 journée (${formatAmount(essentielleEntryAmount, "fr", { compact: true })}). Vos équipes ressortent avec les bons outils installés et 3-5 automatisations testées.`
        : `Quick start in 4 hours (${formatAmount(fourHEntryAmount, "en", { compact: true })}) or 1 day (${formatAmount(essentielleEntryAmount, "en", { compact: true })}). Your teams leave with the right tools installed and 3-5 automations tested.`,
      recommendation: isFr ? "Voir les formations équipe" : "See team trainings",
      href: "/interventions/collectives",
    },
    {
      level: isFr ? "Niveau 2" : "Stage 2",
      title: isFr
        ? "Certains utilisent ChatGPT, sans méthode"
        : "Some use ChatGPT, with no method",
      body: isFr
        ? "Coaching individuel 1-to-1 sur le poste de travail de chacun, ou Approfondie 2 jours pour passer l'équipe entière au niveau supérieur. Gains chiffrés en heures gagnées."
        : "1-on-1 individual coaching on each workstation, or 2-day Deep Dive to take the whole team to the next level. Gains quantified in hours saved.",
      recommendation: isFr ? "Voir les coachings individuels" : "See individual coachings",
      href: "/interventions/individuel",
    },
    {
      level: isFr ? "Niveau 3" : "Stage 3",
      title: isFr
        ? "L'équipe est à l'aise, le dirigeant veut piloter"
        : "Team is fluent, executive wants to steer",
      body: isFr
        ? "Journée stratégique 1-to-1 avec le dirigeant : structuration de l'entreprise, chiffrage poste par poste des gains IA, plan d'implémentation prêt à exécuter."
        : "Strategic 1-on-1 day with the executive: company structuring, role-by-role quantification of AI gains, ready-to-execute implementation plan.",
      recommendation: isFr ? "Voir les offres dirigeants" : "See executives offers",
      href: "/interventions/dirigeants",
    },
  ] as const;

  return (
    <Section
      tone="sand"
      eyebrow={isFr ? "Trouvez votre intervention" : "Find your session"}
      title={isFr ? "À quel stade " : "Where are you "}
      titleEm={isFr ? "êtes-vous ?" : "right now?"}
      description={
        isFr
          ? "Trois niveaux, trois bénéfices concrets. En 1 question, vous voyez ce que vos équipes vont gagner."
          : "Three levels, three concrete benefits. In 1 question, you see what your team will gain."
      }
      contentClassName={TIGHT_X}
    >
      <div className="grid gap-6 sm:grid-cols-3">
        {cards.map((card, idx) => (
          <article key={idx} className="bg-paper border-border relative rounded-2xl border p-6">
            <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
              {card.level}
            </p>
            <h3 className="text-fg mt-2 text-xl leading-snug font-semibold">{card.title}</h3>
            <p className="text-fg-soft mt-3 text-base leading-relaxed">{card.body}</p>
            <p className="text-fg-muted mt-4 text-[12px] tracking-wide">
              <span className="text-fg font-medium">
                {isFr ? "Recommandé : " : "Recommended: "}
              </span>
              <Link
                href={card.href as never}
                {...villeAttr}
                className="text-terracotta-deep hover:text-terracotta font-medium underline underline-offset-4"
              >
                {card.recommendation}
              </Link>
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
