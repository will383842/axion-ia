import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { SERVICES, serviceOfficial, type ServiceId } from "@/content/services";

/**
 * Bandeau « parcours » — la phrase de positionnement Axion-IA, portée à
 * l'identique en tête des 5 pages hubs de service.
 *
 * Pourquoi ce composant (audit positionnement Will, 2026-07-28) :
 * les 5 hubs racontaient cinq histoires séparées. Un dirigeant qui atterrissait
 * sur /formations ne pouvait pas deviner qu'Axion-IA déploie aussi en
 * production ; celui qui atterrissait sur /implementation ne savait pas qu'il
 * pouvait tester à moindre risque par une journée de formation. Chaque page
 * vendait UNE prestation au lieu de vendre LA compétence.
 *
 * La phrase retenue — « Celui qui forme est celui qui déploie. » — n'est pas un
 * slogan : c'est le seul différenciateur qu'un concurrent ne peut pas copier.
 * Les organismes de formation ne codent pas ; les agences ne forment pas. Elle
 * transforme aussi la journée d'entrée en test rationnel : le dirigeant qui
 * hésite sur un projet à 40 k€ peut évaluer, pour le prix d'une journée, la
 * personne exacte qui le réalisera.
 *
 * Effets recherchés :
 *   1. narratif — une seule histoire sur les 5 hubs, quel que soit le point
 *      d'entrée ;
 *   2. maillage — chaque hub pointe vers les 4 autres, ce qui rééquilibre
 *      `/un-a-un` et `/sites-web-augmentes` (les 2 hubs les moins liés du site
 *      lors de l'audit : 16 et 15 fichiers entrants, contre 37 pour `/audit`) ;
 *   3. AEO — les 5 noms officiels apparaissent ensemble sur chaque hub, ce qui
 *      aide les moteurs génératifs à consolider l'entité « services Axion-IA ».
 *
 * Contraintes tenues :
 *   • Server Component pur — zéro JS ajouté (budget First Load ≤ 75 KB gz).
 *   • Aucune image, aucune police supplémentaire, hauteur intrinsèque stable →
 *     CLS = 0 (cible interne stricte).
 *   • Les libellés dérivent tous du SSOT `src/content/services.ts` : renommer un
 *     service se propage ici sans intervention.
 */

interface ServiceJourneyBandProps {
  /** Service de la page courante — affiché en évidence, non cliquable. */
  currentId: ServiceId;
  isFr: boolean;
  className?: string;
}

export function ServiceJourneyBand({
  currentId,
  isFr,
  className,
}: ServiceJourneyBandProps): React.ReactNode {
  const headline = isFr
    ? "Celui qui forme est celui qui déploie."
    : "The people who train your teams are the ones who ship your AI.";

  const subline = isFr
    ? "Un seul interlocuteur senior, du premier atelier à la mise en production. Vous entrez par le besoin du moment — on construit la suite avec vous."
    : "One senior partner, from first workshop to production. Start wherever you are today — we build the rest with you.";

  const stepsLabel = isFr ? "Les 5 étapes du parcours" : "The 5 steps of the journey";

  return (
    <section
      aria-label={isFr ? "Positionnement Axion-IA" : "Axion-IA positioning"}
      className={cn("bg-sand border-border-strong/30 border-y py-8 sm:py-10", className)}
    >
      <Container>
        <p className="text-fg font-serif text-xl leading-snug tracking-tight italic sm:text-2xl">
          {headline}
        </p>
        <p className="text-fg-soft mt-3 max-w-3xl text-sm leading-relaxed sm:text-base">
          {subline}
        </p>

        <nav aria-label={stepsLabel} className="mt-5">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            {SERVICES.map((s, i) => {
              const label = serviceOfficial(s, isFr);
              const isCurrent = s.id === currentId;
              return (
                <li key={s.id} className="flex items-center gap-x-2">
                  {i > 0 ? (
                    <span aria-hidden="true" className="text-fg-muted/50 select-none">
                      ·
                    </span>
                  ) : null}
                  {isCurrent ? (
                    // Page courante : jamais un lien vers elle-même (auto-référence
                    // inutile pour le crawl, et confuse au clavier).
                    <span
                      aria-current="page"
                      className="bg-terracotta/10 text-terracotta-deep rounded-full px-3 py-1 font-semibold"
                    >
                      {label}
                    </span>
                  ) : (
                    <Link
                      href={s.href as never}
                      className="text-fg-soft hover:text-terracotta-deep hover:bg-terracotta/5 rounded-full px-3 py-1 underline-offset-4 transition hover:underline"
                    >
                      {label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </Container>
    </section>
  );
}
