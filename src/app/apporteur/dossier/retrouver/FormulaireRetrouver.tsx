"use client";
// use-client: enveloppe du formulaire commun « Retrouver mon espace » (FAC-10).

import { FormulaireRetrouver as FormulaireCommun } from "@/components/dossier-en-ligne/FormulaireRetrouver";

import { demanderLienEspace } from "./actions";

export function FormulaireRetrouver() {
  return <FormulaireCommun demanderLien={demanderLienEspace} />;
}
