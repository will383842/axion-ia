// Textes de « Retrouver mon lien » du formateur (lot L6, F14), hors du fichier d'actions
// (un fichier « use server » n'exporte que des fonctions asynchrones).

export type { EtatRetrouver } from "@/components/dossier-en-ligne/FormulaireRetrouver";

/** Le seul message rendu après une demande valide, quoi qu'il se soit passé. */
export const MESSAGE_RETROUVER =
  "Si cette adresse est connue, un e‑mail vient de partir. " +
  "Regardez votre boîte de réception (et vos indésirables) dans quelques minutes.";
