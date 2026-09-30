/**
 * Qui a animé une session — module PUR.
 *
 * 🔴 Audit du 2026-09-30 : le formulaire « Nouvelle appréciation » proposait,
 * en qualité « Formateur », TOUS les formateurs actifs. On pouvait donc verser
 * au registre de l'indicateur 30 l'avis d'un formateur sur une session qu'il
 * n'a jamais animée — une voix distincte fabriquée, que le moteur comptait.
 *
 * Un formateur a animé la session s'il en est le formateur principal, s'il y
 * est affecté (`sessionFormateurs`) ou s'il a tenu au moins une journée
 * (`jours.trainerId`). Les trois sources existent parce qu'une session peut
 * être co-animée ou changer d'intervenant en cours de route.
 */

export interface SessionAnimateurs {
  readonly formateurPrincipalId: string | null;
  readonly sessionFormateurs: ReadonlyArray<{ readonly trainerId: string }>;
  readonly jours: ReadonlyArray<{ readonly trainerId: string | null }>;
}

export function formateursDeLaSession(s: SessionAnimateurs): string[] {
  const ids = new Set<string>();
  if (s.formateurPrincipalId) ids.add(s.formateurPrincipalId);
  for (const sf of s.sessionFormateurs) ids.add(sf.trainerId);
  for (const j of s.jours) if (j.trainerId) ids.add(j.trainerId);
  return [...ids];
}
