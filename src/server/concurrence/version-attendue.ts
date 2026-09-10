/**
 * Verrou optimiste — empêcher qu'une sauvegarde écrase une modification qu'on
 * n'a pas vue.
 *
 * ## Le risque, énoncé par celui qui le court
 *
 * `AdminConflictDialog` porte, depuis mai 2026, cette phrase : « Will ouvre la
 * même fiche dans 2 onglets et édite dans les 2. Sans protection : dernier
 * write gagne silencieusement, modifs externes écrasées. » Le composant a été
 * écrit, puis **branché nulle part pendant quatre mois** — la protection
 * n'existait que sur le papier.
 *
 * ⚠️ **Le périmètre annoncé en mai n'est plus le bon, et il faut le savoir avant
 * d'étendre ce module.** Le docstring d'origine visait « Publication /
 * Reservation / Devis / Facture ». Mesuré le 2026-09-10 :
 *
 *   · `Reservation` **n'existe plus** comme modèle — les rendez-vous viennent
 *     d'un webhook Calendly (`CalendlyEvent`) et ne s'éditent pas ;
 *   · `Devis` et `FactureFormation` ne s'éditent **pas champ par champ**. Ce
 *     sont des workflows (accepter, refuser, émettre) : deux onglets n'y font
 *     rien perdre, chaque action est idempotente ou refusée par sa transition.
 *
 * ## 🔴 LA CONSOLE ÉDITORIALE A DÉJÀ CE VERROU, ET LE SIEN EST MEILLEUR
 *
 * `EdPublication` porte un COMPTEUR (`versionCourante Int`), incrémenté à chaque
 * modification du corps, et `modifierPublicationAction` refuse déjà d'écrire
 * quand le compteur a bougé — avec un message qui dit quoi faire. C'est en
 * place, testé, et **ce module n'a rien à y apporter**.
 *
 * Un compteur vaut mieux qu'une date, et il faut le dire plutôt que de laisser
 * croire l'inverse : il est insensible aux horloges, à la précision de
 * sérialisation, et deux écritures dans la même milliseconde restent
 * distinguables. Ce module n'utilise `updatedAt` que parce qu'`Article` n'a pas
 * de compteur et qu'en ajouter un demanderait une migration.
 *
 * ⚠️ **NE PAS poser ce module sur la console éditoriale.** Son champ s'appelle
 * aussi `versionAttendue` mais porte un ENTIER. Voir la note de
 * {@link lireVersionAttendue} : la collision de nom a bien failli être une
 * panne, pas une gêne.
 *
 * ## Le protocole, en trois temps
 *
 * 1. L'écran d'édition rend la version qu'il a chargée dans un champ caché
 *    (`versionAttendue`), au format ISO.
 * 2. L'action serveur relit `updatedAt` en base et appelle {@link versionPerimee}
 *    AVANT d'écrire. Si la base est plus récente, elle rend le conflit au lieu
 *    d'écrire.
 * 3. L'écran ouvre `AdminConflictDialog`. « Écraser » renvoie le formulaire avec
 *    `forcerEcrasement`, qui saute la vérification — c'est un choix EXPLICITE de
 *    l'utilisateur, pas un contournement.
 *
 * 🔑 **Pourquoi une comparaison de dates et pas un verrou en base.** Un verrou
 * pessimiste (poser un « en cours d'édition ») laisse des verrous orphelins dès
 * qu'un onglet est fermé sans prévenir, et il faut alors une purge, donc un
 * délai, donc un réglage. La comparaison de version ne laisse aucun état
 * derrière elle : elle ne coûte qu'une lecture, au moment où l'on écrit.
 *
 * ⚠️ Ce n'est PAS une transaction : entre la lecture et l'écriture, une autre
 * requête peut passer. La fenêtre est de quelques millisecondes contre les
 * minutes que dure une saisie — le défaut visé est l'onglet oublié, pas la
 * course entre deux requêtes simultanées. Le dire, plutôt que de laisser croire
 * à une garantie forte.
 */

/**
 * Nom du champ caché porté par les formulaires.
 *
 * 🔴 LE SUFFIXE `Iso` N'EST PAS DÉCORATIF. Ce champ s'est d'abord appelé
 * `versionAttendue` — le nom EXACT qu'utilise déjà la console éditoriale pour un
 * ENTIER (`versionCourante`). Deux champs homonymes portant des types
 * différents, dans le même dépôt, sur le même genre de formulaire.
 *
 * 🔑 La collision n'était pas une gêne de lecture, c'était une panne : `new
 * Date("3")` rend une date VALIDE (mars 2001). Un compteur lu comme une date
 * aurait donné une version « attendue » de 2001, donc systématiquement périmée,
 * donc **toute sauvegarde refusée** — exactement le mode de panne que ce module
 * documente comme celui qui fait retirer un verrou.
 */
export const CHAMP_VERSION_ATTENDUE = "versionAttendueIso";

/** Nom du champ qui autorise l'écrasement délibéré. */
export const CHAMP_FORCER_ECRASEMENT = "forcerEcrasement";

/**
 * Conflit rendu par une action serveur quand la base a bougé sous l'éditeur.
 *
 * Les deux dates sont des chaînes ISO : elles traversent la frontière
 * serveur → client d'une action, et un `Date` n'y survit pas partout de la même
 * façon selon les versions. Le formatage lisible est fait par l'écran.
 */
export interface ConflitDeVersion {
  readonly conflit: true;
  /** `updatedAt` lu en base au moment de la tentative d'écriture. */
  readonly versionServeur: string;
  /** `updatedAt` que l'éditeur avait chargé. */
  readonly versionLocale: string;
}

/**
 * Lit la version attendue dans un `FormData`. Rend `null` si absente ou illisible.
 *
 * ⚠️ **On exige la FORME ISO-8601, pas « ce que `Date` accepte ».** `new Date()`
 * est extraordinairement permissif : `"3"` devient mars 2001, `"2026"` devient
 * le 1ᵉʳ janvier 2026. Se contenter de « la date est-elle valide ? » laisserait
 * un compteur, un identifiant ou une année nue produire une version plausible
 * et fausse — et un verrou qui compare des dates fausses refuse tout.
 *
 * 🔑 Le repli est `null`, c'est-à-dire « pas de verrou », JAMAIS « périmé ». Une
 * garde de concurrence doit échouer dans le sens qui laisse passer : un refus
 * injustifié se voit tout de suite et fait retirer la garde ; une protection
 * absente ne fait que rendre le comportement d'avant.
 */
const FORME_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function lireVersionAttendue(formData: FormData): string | null {
  const brut = formData.get(CHAMP_VERSION_ATTENDUE);
  if (typeof brut !== "string" || !FORME_ISO.test(brut.trim())) return null;
  const d = new Date(brut.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Vrai si l'utilisateur a explicitement demandé à écraser. */
export function ecrasementForce(formData: FormData): boolean {
  const brut = formData.get(CHAMP_FORCER_ECRASEMENT);
  return brut === "1" || brut === "true" || brut === "on";
}

/**
 * Vrai si la base est plus récente que ce que l'éditeur avait chargé.
 *
 * 🔑 **Une version attendue ABSENTE ne vaut jamais « périmée ».** Un formulaire
 * qui ne pose pas encore le champ, une création, un appel programmatique :
 * aucun n'a de version à comparer. Refuser dans ce cas transformerait un
 * mécanisme de protection en panne généralisée — c'est la faute qui rend une
 * garde inacceptable et la fait retirer.
 *
 * ⚠️ On compare à la MILLISECONDE près, mais avec une tolérance d'égalité :
 * `serveur === attendue` n'est PAS un conflit. C'est le cas normal — l'éditeur
 * a chargé exactement la version qu'il s'apprête à remplacer.
 */
export function versionPerimee(
  versionServeur: Date | string | null | undefined,
  versionAttendue: string | null,
): boolean {
  if (versionAttendue === null) return false;
  if (versionServeur === null || versionServeur === undefined) return false;
  const serveur = new Date(versionServeur).getTime();
  const attendue = new Date(versionAttendue).getTime();
  if (Number.isNaN(serveur) || Number.isNaN(attendue)) return false;
  return serveur > attendue;
}

/** Fabrique le conflit à rendre à l'écran. */
export function conflitDeVersion(
  versionServeur: Date | string,
  versionAttendue: string,
): ConflitDeVersion {
  return {
    conflit: true,
    versionServeur: new Date(versionServeur).toISOString(),
    versionLocale: new Date(versionAttendue).toISOString(),
  };
}
