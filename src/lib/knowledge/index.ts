/**
 * Barrel export `src/lib/knowledge/` (convention §11.2.2 master prompt).
 *
 * Permet d'importer via `@/lib/knowledge` sans détailler chaque sous-fichier.
 * V1 minimal — étendu KB-4+ (state-machine, jsondiff, search-fts, etc.).
 */

export {
  ALIVE_WHERE,
  PUBLIC_VISIBLE_WHERE,
  CLIENT_VISIBLE_WHERE,
  COMMON_ENTRY_INCLUDE,
  DETAILED_ENTRY_INCLUDE,
  adminVisibleWhere,
  buildListWhere,
  isFrontVisible,
} from "./prisma-helpers";

export {
  mapLegacyStatusToKb,
  mapArticleToEntryInput,
  mapTranslationToKnowledgeTranslationInput,
  type ArticleWithRelations,
} from "./legacy-import-mapping";

export {
  KB_TRANSITIONS,
  validateTransition,
  allowedTransitionsFrom,
  type AdminRoleString,
  type KbTransition,
  type KbTransitionRoleRequirement,
  type TransitionContext,
  type TransitionDecision,
} from "./state-machine";

export { makeEntrySnapshot, type EntrySnapshot, type EntrySnapshotInput } from "./snapshot";
