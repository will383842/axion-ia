// Matériel demandé aux stagiaires — une seule formulation, reprise partout.
//
// Décision de Will du 2026-09-18 : hors séminaire, le stagiaire utilise son
// smartphone OU un ordinateur. C'est aussi ce que dit la base
// (`formations.moyens_techniques`), imprimée sur le programme PDF et la
// convocation. Deux formations restent sur ordinateur, confirmé par Will le
// 2026-09-18 : IA pour l'IT et IA pour l'automatisation (surcharges `materielFr`).
//
// Module sans aucune dépendance : `catalog-v2.ts` et `catalog-v2-facts.ts`
// l'importent tous deux sans risquer d'import circulaire.

/** Début commun du matériel annoncé, complété par chaque fiche si besoin. */
export const MATERIEL_SMARTPHONE_OU_ORDINATEUR = "Smartphone ou ordinateur, connexion internet";

/**
 * Formations aux exercices sur tableur — décision de Will du 2026-09-18 :
 * IA pour la finance, les achats, le commerce et les équipes.
 */
export const MATERIEL_TABLEUR = `${MATERIEL_SMARTPHONE_OU_ORDINATEUR} ; un ordinateur est recommandé pour les exercices sur tableur ; accès aux outils IA (comptes préparés en amont avec vous si besoin)`;
