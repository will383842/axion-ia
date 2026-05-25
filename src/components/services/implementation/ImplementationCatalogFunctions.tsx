/**
 * ImplementationCatalogFunctions — Catalogue 8 fonctions automatisables.
 *
 * Sprint A · Phase 2 Extract-3 (Will 2026-05-25) — extrait depuis
 * `src/app/[locale]/implementation/page.tsx` (l.916-981). Grille de cartes
 * `CaseStudyCard` (1 par fonction métier via `AUTOMATISATIONS`) — cœur de la
 * page conversion. Le H2 secondaire inclut le nom de ville quand `villeContext`
 * est fourni. Footer avec lien direct contact + approche par techno.
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { Link } from "@/i18n/navigation";
import { AUTOMATISATIONS } from "@/content/automatisations";
import type { VilleContext } from "@/components/services/types";

export interface ImplementationCatalogFunctionsProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

export function ImplementationCatalogFunctions({
  isFr,
  villeContext,
}: ImplementationCatalogFunctionsProps): ReactNode {
  const loc: "fr" | "en" = isFr ? "fr" : "en";

  const title = villeContext
    ? isFr
      ? `Choisissez le département à`
      : `Pick the function to`
    : isFr
      ? "Choisissez le département à"
      : "Pick the function to";

  const titleEm = villeContext
    ? isFr
      ? `automatiser à ${villeContext.name}`
      : `automate in ${villeContext.name}`
    : isFr
      ? "automatiser"
      : "automate";

  const description = villeContext
    ? isFr
      ? `8 fonctions d'entreprise, ~50 automatisations prêtes à installer chez les entreprises de ${villeContext.name} et sa région. Cliquez sur un domaine pour voir tout ce que l'on peut mettre en place — du standard téléphonique IA au chiffrage de chantier en 30 secondes.`
      : `8 business functions, ~50 automations ready to install for ${villeContext.name}-area companies. Click on an area to see everything we can set up — from AI phone receptionist to 30-second project quoting.`
    : isFr
      ? "8 fonctions d'entreprise, ~50 automatisations prêtes à installer. Cliquez sur un domaine pour voir tout ce que l'on peut mettre en place — du standard téléphonique IA au chiffrage de chantier en 30 secondes."
      : "8 business functions, ~50 automations ready to install. Click on an area to see everything we can set up — from AI phone receptionist to 30-second project quoting.";

  return (
    <Section
      id="catalogue"
      eyebrow={isFr ? "Catalogue par fonction" : "Catalogue by function"}
      title={title}
      titleEm={titleEm}
      description={description}
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AUTOMATISATIONS.map((cat) => {
          const c = cat[loc];
          return (
            <li key={cat.slug}>
              <CaseStudyCard
                href={`/implementation/par-fonction/${cat.slug}`}
                title={c.cardTitle}
                excerpt={c.cardTagline}
                industry={c.eyebrow}
                metric={`${c.items.length} ${isFr ? "automatisations" : "automations"}`}
              />
            </li>
          );
        })}
      </ul>
      <div className="border-border mt-12 flex flex-col items-start gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-fg-soft max-w-xl text-base leading-relaxed">
          {isFr ? (
            <>
              <strong className="text-fg font-semibold">
                Votre cas n&apos;est pas dans la liste ?
              </strong>{" "}
              Toute tâche répétitive est automatisable. Décrivez votre besoin,{" "}
              <Link
                href="/contact"
                className="text-terracotta-deep font-semibold underline-offset-4 hover:underline"
              >
                devis ferme sous 48 h
              </Link>
              .
            </>
          ) : (
            <>
              <strong className="text-fg font-semibold">Your case is not on the list?</strong> Any
              repetitive task can be automated. Describe your need,{" "}
              <Link
                href="/contact"
                className="text-terracotta-deep font-semibold underline-offset-4 hover:underline"
              >
                firm quote within 48 h
              </Link>
              .
            </>
          )}
        </p>
        <Link
          href="/implementation/par-techno"
          className="text-fg-muted hover:text-terracotta-deep text-sm font-medium underline-offset-4 hover:underline"
        >
          {isFr ? "Approche par technologie (avancé) →" : "Tech-driven approach (advanced) →"}
        </Link>
      </div>
    </Section>
  );
}
