// Matériel demandé aux stagiaires — une seule formulation, reprise partout.
//
// Décision de Will du 2026-09-18 : hors séminaire, le stagiaire utilise son
// smartphone OU un ordinateur. Deux formations restent sur ordinateur, confirmé
// par Will le même jour : IA pour l'IT et IA pour l'automatisation (surcharges
// `materielFr`) ; pour les quatre formations à exercices sur tableur, un
// ordinateur est recommandé (`MATERIEL_TABLEUR`).
//
// Décision de Will du 2026-09-19 : EN DISTANCIEL, un ordinateur avec caméra et
// micro (`MATERIEL_DISTANCIEL`) ; ce qui précède vaut pour le présentiel.
//
// ⚠️ La base (`formations.moyens_techniques`, imprimée sur le programme PDF) est
// un texte distinct, tenu à la main dans la console : ce module ne l'alimente
// pas, et elle ne porte pas la précision « tableur ».
//
// Module sans aucune dépendance : `catalog-v2.ts` et `catalog-v2-facts.ts`
// l'importent tous deux sans risquer d'import circulaire.

/** Début commun du matériel annoncé, complété par chaque fiche si besoin. */
export const MATERIEL_SMARTPHONE_OU_ORDINATEUR = "Smartphone ou ordinateur, connexion internet";

/**
 * Formations aux exercices sur tableur — décision de Will du 2026-09-18 :
 * IA pour la finance, les achats, le commerce et les équipes.
 */
/**
 * Matériel EN DISTANCIEL — décision de Will du 2026-09-19 : le smartphone ne
 * suffit pas pour suivre une visio et pratiquer en même temps. Même exigence
 * que la convocation distanciel (`convocation.tsx`, « Équipement requis
 * (distanciel) »). Ajouté par `getFormationMateriel` à toute fiche dont la
 * modalité comprend le distanciel.
 */
export const MATERIEL_DISTANCIEL =
  "un ordinateur avec caméra et micro, et l'application de visioconférence installée et testée avant la session";

export const MATERIEL_TABLEUR = `${MATERIEL_SMARTPHONE_OU_ORDINATEUR} ; un ordinateur est recommandé pour les exercices sur tableur ; accès aux outils IA (comptes préparés en amont avec vous si besoin)`;
