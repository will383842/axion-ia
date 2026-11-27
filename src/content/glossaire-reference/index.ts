import { TERMES_FONDAMENTAUX } from "./termes-fondamentaux";
import { TERMES_MODELES_INFRA } from "./termes-modeles-infra";
import { TERMES_RAG_AGENTS } from "./termes-rag-agents";
import { TERMES_SECURITE_GOUVERNANCE } from "./termes-securite-gouvernance";
import { TERMES_USAGES_VISIBILITE } from "./termes-usages-visibilite";
import type { TermeSource } from "./types";

export type { CategorieGlossaire, OffreGlossaire, TermeSource } from "./types";

/** Date de dernière mise à jour éditoriale du glossaire (affichée et reprise dans le JSON-LD). */
export const GLOSSAIRE_DATE_MISE_A_JOUR = "2026-11-18";

/** Les termes du glossaire de référence, dans l'ordre de lecture. */
export const TERMES_GLOSSAIRE: readonly TermeSource[] = [
  ...TERMES_FONDAMENTAUX,
  ...TERMES_MODELES_INFRA,
  ...TERMES_RAG_AGENTS,
  ...TERMES_SECURITE_GOUVERNANCE,
  ...TERMES_USAGES_VISIBILITE,
];
