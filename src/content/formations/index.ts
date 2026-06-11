// SSOT « squelette formation » — point d'entrée public.
//
// Importer depuis `@/content/formations` partout (interventions.ts, taxonomy,
// subpages, booking-catalog, seed Qualiopi). Source unique durée + contenu.

export type {
  FormationFamily,
  FormationDurationId,
  FormationDurationCanonical,
  FormationProgrammeItem,
  FormationProgrammeDay,
  FormationProgramme,
  FormationSkeleton,
} from "./types";

export type { ModalitePedagogique } from "./modalites";
export { PRESENTIEL_DISTANCIEL, PRESENTIEL_SEUL, TOUTES_MODALITES } from "./modalites";

export {
  FORMATION_DURATIONS,
  FORMATION_SKELETONS,
  getDurationCanonical,
  getSkeletonById,
  getSkeletonByTier,
  getSkeletonBySlug,
  formationDurationIso,
  formationDurationDays,
} from "./skeletons";
