/**
 * Libellés des anomalies de chaînage — SOURCE UNIQUE.
 *
 * 🔴 CES SIX CODES ÉTAIENT TRADUITS À UN ENDROIT ET BRUTS À UN AUTRE. Le
 * registre du mode auditeur les rendait en phrases ; le registre des signatures
 * AFEST, lui, les concaténait tels quels dans une phrase française :
 * « chaîne altérée : empreinte_invalide, rupture_chainage ». Les deux écrans
 * servent la même preuve, à la même auditrice.
 *
 * Les clés sont celles réellement posées par `emargement/hash.ts` — relevées
 * dans le code. Une anomalie inconnue est CITÉE : sur un registre de preuve,
 * faire disparaître ce qu'on ne sait pas nommer serait le pire des replis.
 */
export const LIBELLE_ANOMALIE_CHAINE: Record<string, string> = {
  premier_maillon_chaine: "premier maillon incohérent",
  rupture_chainage: "maillon manquant — une ligne semble avoir été retirée après coup",
  empreinte_invalide: "empreinte invalide — le contenu scellé ne correspond plus",
  version_inconnue: "version de signature inconnue — l'empreinte n'est plus recalculable",
  tuple_irrecalculable: "données insuffisantes pour vérifier",
  maillon_illisible: "maillon illisible",
};

export function libelleAnomalieChaine(type: string): string {
  return LIBELLE_ANOMALIE_CHAINE[type] ?? `« ${type} »`;
}
