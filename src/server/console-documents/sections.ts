// SSOT des sections (buckets) de documents console génériques.
// Mappe le segment d'URL ↔ l'enum Prisma `ConsoleDocSection` + libellés FR.
//
// NB — Formations / 1-to-1 / Audit ne sont PAS ici : ce sont des kits
// pédagogiques Qualiopi versionnés (InterventionDocument), rendus par la route
// `[famille]`. Les sections ci-dessous sont les buckets de FICHIERS génériques.

import type { ConsoleDocSection } from "../../../prisma/generated/client";

export interface ConsoleDocSectionDef {
  /** Valeur enum Prisma. */
  key: ConsoleDocSection;
  /** Segment d'URL (sous `/documents-interventions/`). */
  segment: string;
  /** Libellé FR (onglet + titre de page). */
  label: string;
  /** Description courte affichée en tête de page. */
  description: string;
}

export const CONSOLE_DOC_SECTIONS: ReadonlyArray<ConsoleDocSectionDef> = [
  {
    key: "implementations",
    segment: "implementations",
    label: "Implémentations",
    description:
      "Documents liés aux missions d'implémentation IA (propositions-types, cahiers de recette, livrables réutilisables).",
  },
  {
    key: "sites_web",
    segment: "sites-web",
    label: "Sites web",
    description:
      "Documents liés aux prestations sites web & SaaS (offres-types, spécifications, livrables réutilisables).",
  },
  {
    key: "autres",
    segment: "autres",
    label: "Autres",
    description:
      "Documents transverses de l'entreprise : plaquette de présentation, pièces administratives, etc.",
  },
];

/** Résout un segment d'URL en définition de section (ou undefined si inconnu). */
export function getConsoleDocSectionBySegment(segment: string): ConsoleDocSectionDef | undefined {
  return CONSOLE_DOC_SECTIONS.find((s) => s.segment === segment);
}

/** Résout une valeur enum en définition de section. */
export function getConsoleDocSection(key: ConsoleDocSection): ConsoleDocSectionDef | undefined {
  return CONSOLE_DOC_SECTIONS.find((s) => s.key === key);
}
