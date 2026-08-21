/**
 * Qui compte comme INSCRIT ACTIF — la définition, à un seul endroit.
 *
 * ## Pourquoi ce module existe
 *
 * 🔴 Le prédicat « hors abandon et exclusion » était écrit à la main **quatorze
 * fois, dans onze fichiers** — indicateurs, pilotage, présence, financement,
 * alertes, crons, documents, satisfaction, liens d'émargement. L'une des copies
 * l'écrivait même dans l'ordre inverse (`["exclu", "abandon"]`), preuve qu'il
 * s'agissait bien de recopies indépendantes et non d'une constante partagée.
 *
 * ⚠️ Ces quatorze lectures alimentent des chiffres qui doivent COÏNCIDER : le
 * nombre d'inscrits d'une session au BPF, le dénominateur du taux de présence,
 * le décompte du dossier de financement, la base des indicateurs Qualiopi. Le
 * jour où l'on ajoute un statut de sortie — un report, une annulation — la
 * copie qu'on oublie compte une personne de trop, et deux écrans de la console
 * affichent deux vérités sur la même session.
 *
 * 🔑 C'est la plus grosse occurrence, dans ce dépôt, du motif « un prédicat
 * recopié diverge ». Les précédentes ont coûté : `enAttente()`,
 * `pieceAdmissibleAuDossier()`, `filtreMemePiece`, `estMandataireDeLaLettre`,
 * `estMembreDeSession`, et le prédicat de trace de présence.
 *
 * ## Ce que « sortie » veut dire, et ce qu'elle ne veut pas dire
 *
 * ⚠️ Renoncer n'est pas être absent. Un `abandon` ou une exclusion fait SORTIR
 * du dispositif : l'absence de trace de présence y est normale, et compter ces
 * personnes au dénominateur ferait chuter un taux sans qu'aucun manquement
 * n'ait eu lieu. C'est l'inverse d'une absence non justifiée, qui, elle, reste
 * dans le décompte.
 */

import type { EnrollmentStatut } from "../../../../prisma/generated/client";

/**
 * Les statuts qui font SORTIR du dispositif.
 *
 * ⚠️ Typé `EnrollmentStatut` et non `string` : renommer un statut dans le schéma
 * casse la compilation ici, au lieu de laisser un filtre qui ne correspond plus
 * à rien et ne retire donc plus personne.
 */
export const STATUTS_SORTIS: ReadonlyArray<EnrollmentStatut> = ["abandon", "exclu"];

/** Fragment de `where` Prisma : les inscriptions encore dans le dispositif. */
export function inscriptionsActives(): { statut: { notIn: EnrollmentStatut[] } } {
  return { statut: { notIn: [...STATUTS_SORTIS] } };
}

/** Ce statut désigne-t-il une inscription encore dans le dispositif ? */
export function estInscriptionActive(statut: EnrollmentStatut | string): boolean {
  return !(STATUTS_SORTIS as ReadonlyArray<string>).includes(statut);
}
