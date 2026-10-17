"use client";
// use-client: le découpage du code n'a lieu que depuis un composant client (un import
// dynamique depuis un composant serveur reste dans le chunk de la page).

/**
 * Panneaux de la fiche formateur CHARGÉS À LA DEMANDE : rendus sous condition (statut,
 * rôle, interrupteur), leur code n'a rien à faire dans le chunk de la page pour toutes
 * les autres fiches.
 *
 *   · Qualiopi ind. 21 — évaluation des compétences : sous-traitant + `habiliter_formateur` ;
 *   · lot L12i — présentation de la méthode : sous-traitant + interrupteur
 *     `formateurs.presentation_payee` (éteint tant que le module est gelé).
 *
 * (La fin de collaboration a son propre relais, `FinCollaborationPanelDiffere.tsx`,
 * posé par QNC L13.)
 *
 * Mesuré le 17/10/2026, somme des page chunks de la console : `main` 560,36 kB ; la PR
 * ind. 21 avec le panneau importé tel quel 563,13 kB, avec `next/dynamic` 561,2 kB, avec
 * `React.lazy` 560,47 kB. `React.lazy` et non `next/dynamic` : celui-ci tire son runtime
 * (`loadable`, `BailoutToCSR`, `PreloadChunks`) dans le chunk de la fiche et en reprenait
 * la moitié du gain ; `lazy` et `Suspense` sont déjà dans le chunk React partagé.
 */

import { Suspense, lazy } from "react";

import type { EvaluationCompetencesPanelProps } from "./EvaluationCompetencesPanel";

const EvaluationCompetences = lazy(() =>
  import("./EvaluationCompetencesPanel").then((m) => ({ default: m.EvaluationCompetencesPanel })),
);
const PresentationMethode = lazy(() =>
  import("./PresentationMethodePanel").then((m) => ({ default: m.PresentationMethodePanel })),
);

function Chargement({ titre }: { titre: string }) {
  return (
    <section className="admin-card mb-[var(--space-admin-5)]" aria-busy="true">
      <p className="admin-muted">Chargement — {titre}…</p>
    </section>
  );
}

export function EvaluationCompetencesPanelDiffere(props: EvaluationCompetencesPanelProps) {
  return (
    <Suspense fallback={<Chargement titre="compétences pédagogiques" />}>
      <EvaluationCompetences {...props} />
    </Suspense>
  );
}

export function PresentationMethodePanelDiffere(props: { trainerId: string }) {
  return (
    <Suspense fallback={<Chargement titre="présentation de la méthode" />}>
      <PresentationMethode {...props} />
    </Suspense>
  );
}
