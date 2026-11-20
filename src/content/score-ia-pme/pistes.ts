// Score IA TPE-PME — pistes déduites des freins cochés (plan V2-10 §3.5).
// Table FIXE `frein → piste` : une entrée par valeur de `BARRIER_VALUES_SCORE`.
// Aucun chiffre, aucune promesse de résultat, aucun mot interdit (test T-7).

import { BARRIER_VALUES_SCORE } from "@/lib/score-ia-pme/libelles";

export const PISTES: Readonly<Record<(typeof BARRIER_VALUES_SCORE)[number], string>> = {
  skills: "Commencez par former l'équipe sur un seul outil et un seul usage, avant d'en ajouter.",
  budget:
    "Partez des outils déjà inclus dans vos abonnements actuels avant d'engager une dépense nouvelle.",
  roi: "Choisissez une tâche répétitive, notez le temps qu'elle prend aujourd'hui, puis comparez après un essai.",
  security_rgpd:
    "Écrivez une règle simple : quelles données ne doivent jamais être saisies dans un outil d'IA.",
  data_quality:
    "Rassemblez au même endroit les documents d'un seul sujet avant de les confier à un outil.",
  internal_resistance: "Associez les personnes réticentes au choix de la première tâche à essayer.",
  time: "Réservez chaque semaine un créneau fixe et court pour tester, plutôt qu'un grand chantier.",
  not_priority:
    "Repérez la tâche qui revient le plus souvent dans la semaine : c'est là qu'un essai coûte le moins.",
  // Piste générique (« Aucun frein particulier »).
  none: "Mettez par écrit ce que vous voulez faire avec l'IA, et ce que vous ne voulez pas faire, pour garder le cap.",
};

/** Pistes des freins cochés, au plus `max` (ordre de la sélection). */
export function pistesPour(freins: readonly string[], max: number): string[] {
  const out: string[] = [];
  for (const f of freins) {
    const p = (PISTES as Record<string, string | undefined>)[f];
    if (p && !out.includes(p)) out.push(p);
    if (out.length >= max) break;
  }
  return out;
}
