/**
 * Espace formateur — libellés des options coaching 1-to-1 (SSOT, 2026-06-13).
 *
 * Les slugs d'intervention correspondent au booking-catalog (famille un_a_un).
 * On garde une liste resserrée des prestations 1-to-1 réellement animées en
 * séance (les variantes 2j pointent vers la même page 1j → un seul slug ici).
 */

export const COACHING_INTERVENTIONS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "dirigeant-vision-strategique", label: "Dirigeant · Vision stratégique" },
  { slug: "coaching-decouverte", label: "Collaborateur · Optimisation du poste" },
  { slug: "un-a-un-recurrent", label: "Suivi régulier 1-to-1" },
];

export function coachingInterventionLabel(slug: string): string {
  return COACHING_INTERVENTIONS.find((i) => i.slug === slug)?.label ?? slug;
}

/** Types d'optimisation (enum Prisma `OptimisationType`). */
export const OPTIMISATION_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "automatisation", label: "Automatisation" },
  { value: "delegation", label: "Délégation" },
  { value: "simplification", label: "Simplification" },
  { value: "outillage", label: "Outillage" },
  { value: "organisation", label: "Organisation" },
];

export function optimisationTypeLabel(value: string): string {
  return OPTIMISATION_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Statuts de séance (enum Prisma `CoachingSessionStatut`). */
export const SESSION_STATUTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "planifiee", label: "Planifiée" },
  { value: "realisee", label: "Réalisée" },
  { value: "annulee", label: "Annulée" },
];

export function sessionStatutLabel(value: string): string {
  return SESSION_STATUTS.find((s) => s.value === value)?.label ?? value;
}
