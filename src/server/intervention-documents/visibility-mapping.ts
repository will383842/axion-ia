/**
 * Mapping rôle ↔ visibilité des documents d'intervention (SSOT, 2026-06-13).
 *
 * Les DEUX moitiés de la relation inverse vivent ici pour ne plus jamais
 * diverger (bug détecté en revue E2E : un doc notifié mais invisible au portail) :
 *   - `targetRoles(visibilité)`  : qui NOTIFIER à la publication (notifications.ts)
 *   - `visibilitesForRole(rôle)` : ce qu'un rôle VOIT dans l'espace ressources
 *
 * Invariant (testé) : rôle R ∈ targetRoles(V)  ⟺  V ∈ visibilitesForRole(R).
 *
 * Sémantique métier :
 *   - 'commercial' : visible des commerciaux ET des formateurs (ex. programme).
 *   - 'formateur'  : visible des formateurs uniquement (guides, corrigés).
 *   - 'stagiaire' / 'interne' : PAS destinés à l'équipe commerciale/formateur
 *     (ni notification, ni portail).
 */

export type EquipeRole = "formateur" | "commercial";

const ALL_VISIBILITES = ["stagiaire", "formateur", "commercial", "interne"] as const;

/** Visibilités d'un document qu'un rôle d'équipe a le droit de voir. */
export function visibilitesForRole(role: string): string[] {
  return role === "commercial" ? ["commercial"] : ["formateur", "commercial"];
}

/** Rôles d'équipe à notifier pour un document d'une visibilité donnée. */
export function targetRoles(visibilite: string): EquipeRole[] {
  return (["formateur", "commercial"] as EquipeRole[]).filter((role) =>
    visibilitesForRole(role).includes(visibilite),
  );
}

/** Toutes les visibilités possibles (pour les tests d'exhaustivité). */
export const VISIBILITES = ALL_VISIBILITES;
