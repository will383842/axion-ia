/**
 * Espace formateur collectif — libellés FR partagés (SSOT).
 *
 * Une seule table par enum, importée par toutes les pages : évite les libellés
 * divergents (« Principal » vs « Formateur principal ») et les formats de date
 * incohérents relevés en revue.
 */

import type { RoleFormateur } from "./session-membership";

/** Chemin de la liste des formations collectives (locale FR forcée, EN désactivé). */
export const FORMATEUR_SESSIONS_PATH = "/fr/espace-formateur/sessions";

export const ROLE_FORMATEUR_LABELS: Record<RoleFormateur, string> = {
  principal: "Formateur principal",
  co_formateur: "Co-formateur",
  assistant: "Assistant",
  tuteur_afest: "Tuteur AFEST",
};

export const STATUT_SESSION_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

export const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  hybride: "Hybride",
};

export const STATUT_INSCRIPTION_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  presente: "Présent",
  abandon: "Abandon",
  exclu: "Exclu",
};

/** Libellé sûr : retourne la valeur brute si la clé n'est pas mappée (défensif). */
export function libelle(table: Record<string, string>, cle: string | null | undefined): string {
  if (cle == null) return "—";
  return table[cle] ?? cle;
}

/** Date courte fr-FR (jj/mm/aaaa) — format unique de tout l'espace collectif. */
export function formatDateCourte(d: Date): string {
  return d.toLocaleDateString("fr-FR");
}
