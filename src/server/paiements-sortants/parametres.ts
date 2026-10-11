/**
 * Paiements sortants (FAC-9) — paramètres COMMUNS aux apporteurs, formateurs et
 * organismes. Module neutre : aucune dépendance de zone.
 */

/**
 * Seuil DAS 2 par bénéficiaire et par an pour la déclaration COMMUNE (décision 70,
 * plan 08 §12.6 n° 13) : UN seul paramètre, valeur PRUDENTE de 1 200 € tant que
 * le juriste n'a pas confirmé le seuil de l'article 240 du code général des
 * impôts. Déclarer un bénéficiaire de trop ne coûte rien ; en oublier un est
 * sanctionné.
 *
 * ⚠️ L'export DAS 2 des apporteurs (`apporteurs-reseau/commissions.ts`) garde son
 * propre seuil, inchangé : la bascule vers ce paramètre unique est une décision.
 */
export const SEUIL_DAS2_COMMUN_CENTS = 120_000;

/** Orange à J-5 de la date cible du virement ; rouge une fois passée. */
export const ORANGE_AVANT_DATE_CIBLE_JOURS = 5;

/**
 * Statuts d'un relevé d'honoraires de formateur DONT LE VIREMENT EST DÛ.
 * Miroir de `STATUTS_RELEVE_DU` (`qualiopi/remuneration/echeance.ts`), que ce
 * module neutre ne peut pas importer ; l'égalité est vérifiée par un test.
 */
export const STATUTS_RELEVE_A_VIRER = ["valide", "facture_recue"] as const;
