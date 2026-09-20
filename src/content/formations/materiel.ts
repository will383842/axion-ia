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
// jour : la visio se fait sur ZOOM, l'outil de l'organisme (jamais celui du
// client) — le « rapport des participants » de Zoom Pro sert de relevé de
// connexion (`parse-zoom.ts`, ADR 0048). Le stagiaire le rejoint depuis le
// navigateur de l'ordinateur : il n'y a rien à installer, ni sur place ni à
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
 * suffit pas pour suivre une visio et pratiquer en même temps. Trois éléments,
 * IMPORTÉS tels quels par la convocation distanciel (`convocation.tsx`,
 * « Équipement requis (distanciel) ») : la fiche et la convocation ne peuvent
 * pas diverger. Ajouté par `getFormationMateriel` à toute fiche dont la
 * modalité comprend le distanciel, suivi de ce que la fiche exige au-delà du
 * poste (accès aux outils, environnement de développement, données) : cela
 * vaut à distance comme sur place.
 */
export const DISTANCIEL_ORDINATEUR = "un ordinateur avec caméra et micro";
export const DISTANCIEL_CONNEXION = "une connexion internet stable";
/** Zoom, client web dans le navigateur : rien à installer (Will, 2026-09-19). */
export const DISTANCIEL_VISIO =
  "Zoom, depuis le navigateur (rien à installer), testé avant la session";
export const MATERIEL_DISTANCIEL = [
  DISTANCIEL_ORDINATEUR,
  DISTANCIEL_CONNEXION,
  DISTANCIEL_VISIO,
].join(", ");

/** Début de la partie du matériel qui ne dépend pas du poste : reprise telle quelle à distance. */
export const DEBUT_DES_ACCES = "accès aux outils IA";

/**
 * Formations aux exercices sur tableur — décision de Will du 2026-09-18 :
 * IA pour la finance, les achats, le commerce et les équipes.
 */
export const MATERIEL_TABLEUR = `${MATERIEL_SMARTPHONE_OU_ORDINATEUR} ; un ordinateur est recommandé pour les exercices sur tableur ; accès aux outils IA (comptes préparés en amont avec vous si besoin)`;
