/**
 * L'ÉTAT affiché du questionnaire de cadrage d'un projet (chantier visio,
 * PR 7). Module PUR, lu par la requête (`lireQuestionnaireDuProjet`) et par la
 * vue (`VueQuestionnaire.tsx`).
 *
 * Un questionnaire « en préparation » (brouillon sans question) attend
 * l'étape `questionnaire` du worker. Si cette étape ne tourne plus — échec
 * définitif (« questionnaire vide après vérification » quand le dossier ne
 * laisse rien à demander, IA fermée…), suspendue ou annulée —, il resterait
 * « en préparation » pour toujours et Will ne pourrait plus en demander un
 * autre. La vue le dit donc, et propose de relancer : le geste reprend le même
 * brouillon et remet l'étape « à faire » (`demanderQuestionnaire`).
 *
 * Garde : `un-questionnaire-echoue-peut-etre-relance.spec.tsx`.
 */

import type { StatutEtape } from "../../../prisma/generated/client";

const EN_VOL: ReadonlySet<StatutEtape> = new Set<StatutEtape>(["a_faire", "en_cours"]);

/** La préparation a-t-elle échoué ? Vrai si aucune étape `questionnaire` du projet n'est en vol. */
export function preparationEchouee(
  enPreparation: boolean,
  statutsEtape: ReadonlyArray<StatutEtape>,
): boolean {
  return enPreparation && !statutsEtape.some((s) => EN_VOL.has(s));
}

/** Le bouton « Préparer un (nouveau) questionnaire » / « Relancer » se montre-t-il ? */
export function peutPreparerQuestionnaire(
  q: {
    readonly statut: "brouillon" | "copie" | "reponse_recue" | "clos";
    readonly enPreparation: boolean;
    readonly preparationEchouee: boolean;
  } | null,
): boolean {
  if (q === null) return true;
  if (q.enPreparation) return q.preparationEchouee;
  return q.statut === "clos" || q.statut === "reponse_recue";
}
