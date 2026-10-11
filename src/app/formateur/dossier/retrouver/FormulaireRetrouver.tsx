"use client";
// use-client: enveloppe du formulaire commun « Retrouver mon espace » (FAC-10).

import { FormulaireRetrouver as FormulaireCommun } from "@/components/dossier-en-ligne/FormulaireRetrouver";

import { demanderLienDossier } from "./actions";

export function FormulaireRetrouver() {
  return <FormulaireCommun demanderLienAction={demanderLienDossier} />;
}
