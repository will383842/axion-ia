/**
 * Libellés du suivi de financement — source unique.
 *
 * 🔴 POURQUOI (audit du code, 2026-08-03). `OPCO_STATUT_LABELS` existait en
 * DEUX exemplaires identiques, copiés à la main dans deux pages
 * (`planning/[type]/[id]` et `qualiopi/sessions/[id]/financement`)… et
 * manquait dans les deux autres écrans qui affichent ce même statut :
 * `qualiopi/financements` et `qualiopi/audits/[id]` rendaient la valeur brute.
 *
 * Résultat à l'écran : « Demande en cours » sur deux pages, et
 * « demande_en_cours » sur deux autres, pour exactement la même donnée. Une
 * table dupliquée finit toujours par diverger ; celle-ci avait pris de l'avance
 * en étant simplement absente là où elle manquait le plus.
 */

/** Statuts du dossier OPCO (`enum OpcoStatut`, schema.prisma). */
export const OPCO_STATUT_LABELS: Record<string, string> = {
  non_demande: "Non demandé",
  demande_en_cours: "Demande en cours",
  accord_recu: "Accord reçu",
  refuse: "Refusé",
  paiement_recu: "Paiement reçu",
};

/**
 * Libellé d'un statut OPCO. Un statut absent de la table est CITÉ, jamais
 * maquillé en français : on veut voir qu'il manque, pas lire un identifiant
 * machine pris pour une phrase.
 */
export function libellerStatutOpco(statut: string | null | undefined): string {
  if (!statut) return "—";
  return OPCO_STATUT_LABELS[statut] ?? `« ${statut} »`;
}
