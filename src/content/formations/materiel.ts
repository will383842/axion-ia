// Matériel demandé aux stagiaires, tel que l'affichent les FICHES formation
// (via `getFormationMateriel`). La FAQ (`transversal.ts`) et la page
// `/formations/entreprise` le disent avec leur propre prose, en FR et en EN :
// elles ne reprennent pas ces constantes, et c'est la garde
// `le-materiel-annonce-est-le-meme-partout.spec.ts` qui les tient alignées.
//
// Décision de Will du 2026-09-18 : hors séminaire, le stagiaire utilise son
// smartphone OU un ordinateur. Deux formations restent sur ordinateur, confirmé
// par Will le même jour : IA pour l'IT et IA pour l'automatisation (surcharges
// `materielFr`) ; pour les quatre formations à exercices sur tableur, un
// ordinateur est recommandé (`MATERIEL_TABLEUR`).
//
// Décision de Will du 2026-09-19 : EN DISTANCIEL, un ordinateur avec caméra et
// micro (`MATERIEL_DISTANCIEL`) ; ce qui précède vaut pour le présentiel. Même
// jour, seconde décision : la visio se fait sur Google Meet, qui s'ouvre dans le
// navigateur de l'ordinateur — il n'y a rien à installer, ni sur place ni à
// distance.
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
 * Matériel EN DISTANCIEL — décision de Will du 2026-09-19 : le smartphone ne
 * suffit pas pour suivre une visio et pratiquer en même temps. Même exigence
 * que la convocation distanciel (`convocation.tsx`, « Équipement requis
 * (distanciel) ») — la garde du dispositif d'assistance
 * (`src/server/qualiopi/documents/templates/__tests__/le-dispositif-d-assistance-est-imprime.spec.tsx`)
 * confronte la convocation rendue à cette constante. Ajouté par `getFormationMateriel` à toute fiche dont la modalité
 * comprend le distanciel, suivi de ce que la fiche exige au-delà du poste
 * (accès aux outils, environnement de développement, données) : cela vaut à
 * distance comme sur place.
 */
export const MATERIEL_DISTANCIEL =
  "un ordinateur avec caméra et micro, une connexion internet stable, Google Meet depuis le navigateur (rien à installer), testé avant la session";

/** Début de la partie du matériel qui ne dépend pas du poste : reprise telle quelle à distance. */
export const DEBUT_DES_ACCES = "accès aux outils IA";

/**
 * Formations aux exercices sur tableur — décision de Will du 2026-09-18 :
 * IA pour la finance, les achats, le commerce et les équipes.
 */
export const MATERIEL_TABLEUR = `${MATERIEL_SMARTPHONE_OU_ORDINATEUR} ; un ordinateur est recommandé pour les exercices sur tableur ; accès aux outils IA (comptes préparés en amont avec vous si besoin)`;
