/**
 * Qualiopi — Où MÈNE une alerte (module PUR).
 *
 * ## 🔴 Le défaut : une alerte qui nomme sa cible sans permettre d'y aller
 *
 * L'écran des alertes affiche, sous chaque message, `Cible : Trainer —
 * 11111111-1111-4111-8111-111111111111`. Un type technique et un UUID. Pour agir,
 * l'opérateur doit reconnaître le type, deviner l'écran correspondant, puis
 * recopier l'identifiant dans une URL qu'il compose à la main.
 *
 * C'est la dernière marche de « une alerte prescrit un geste qui existe » : le
 * geste existe, l'écran qui le porte existe — et l'alerte ne mène pas jusqu'à
 * lui. Sur `contrat_cdd_non_remis`, qui est `critique` et dont le message dit
 * « consignez la date sur sa fiche », la fiche était à un copier-coller d'UUID.
 *
 * ## ⚠️ CE MODULE NE FABRIQUE JAMAIS UNE ROUTE QUI N'EXISTE PAS
 *
 * Quinze types de cibles sont émis par l'évaluateur ; six seulement ont un écran
 * de détail. Pour les neuf autres, ce module rend `null` et l'écran garde son
 * affichage textuel — **un lien mort est pire que pas de lien** : il fait
 * cliquer, il rend une 404, et il apprend à ne plus cliquer sur les autres.
 *
 * 🔑 Une garde (`lien-cible.spec.ts`) vérifie que chaque route citée ici EXISTE
 * sur le disque. Sans elle, un renommage de répertoire transformerait la table
 * en collection de liens morts, silencieusement — le fichier compile, l'écran
 * s'affiche, et seul un clic le découvrirait.
 */

/**
 * Segment d'écran de détail, par type de cible.
 *
 * ⚠️ Les ABSENTS sont délibérés, et chacun a sa raison :
 *
 *   · `Enrollment` — une inscription n'a pas d'écran propre, elle se lit dans
 *     sa session. Y mener supposerait de résoudre la session d'abord, ce qu'un
 *     module pur ne peut pas faire ;
 *   · `SousTraitant` — la liste existe, le détail non. Mener à la liste ferait
 *     cliquer pour re-chercher : le gain est nul, la promesse est fausse ;
 *   · `DossierFinancement`, `Reclamation`, `BaremeOpco`, `RgpdDemande`,
 *     `OffreSite`, `EmailOutbox`, `DocumentGenere` — pas d'écran de détail.
 *
 * Le jour où l'un d'eux en obtient un, l'ajouter ici est une ligne — et la garde
 * exigera que le répertoire existe.
 */
const SEGMENT_PAR_CIBLE: Readonly<Record<string, string>> = {
  Trainer: "qualiopi/formateurs",
  TrainerStatement: "qualiopi/remuneration",
  TrainingSession: "qualiopi/sessions",
  Devis: "qualiopi/devis",
  FactureFormation: "qualiopi/facturation",
  Formation: "qualiopi/formations",
};

/** Les types que ce module sait atteindre. Exporté pour la garde. */
export const CIBLES_ATTEIGNABLES: readonly string[] = Object.keys(SEGMENT_PAR_CIBLE);

/** Le segment d'une cible, ou `null`. Exporté pour la garde de routes. */
export function segmentCible(cibleType: string): string | null {
  return Object.prototype.hasOwnProperty.call(SEGMENT_PAR_CIBLE, cibleType)
    ? (SEGMENT_PAR_CIBLE[cibleType] ?? null)
    : null;
}

/**
 * Le lien vers l'écran qui porte le geste, ou `null` s'il n'y en a pas.
 *
 * `base` est le préfixe admin résolu par la page — `/fr/<adminPrefix>` — jamais
 * écrit en dur : le préfixe de la console est SECRET, et un chemin codé en dur
 * ne correspondrait à rien.
 *
 * ⚠️ `cibleId` est refusé s'il ne ressemble pas à un identifiant : il vient de
 * la base, mais il finit dans une URL. Un identifiant vide produirait un lien
 * vers la LISTE — donc un lien qui semble mener à la cible et n'y mène pas.
 */
export function lienCible(
  cibleType: string | null | undefined,
  cibleId: string | null | undefined,
  base: string,
): string | null {
  if (typeof cibleType !== "string" || typeof cibleId !== "string") return null;
  /*
    UNE SEULE condition de forme, et elle couvre tout.

    ⚠️ Il y en avait deux : un `id === ""` explicite, puis le motif ci-dessous.
    Une mutation a montré que la première ne discriminait RIEN — un motif qui
    exige au moins six caractères rejette la chaîne vide par construction. Deux
    conditions dont une ne peut jamais s'exercer donnent l'illusion d'une
    double protection : la seconde disparaîtrait un jour « puisque la première
    suffit », et c'est l'inverse qui est vrai.

    🔑 `trim()`, lui, PORTE : « ␣␣␣ » n'est pas vide, et sans lui il composerait
    un chemin avec des espaces. Le test le vérifie.

    Le motif refuse aussi la barre et l'espace. L'identifiant vient de la base,
    mais il finit dans une URL : une valeur inattendue composerait un chemin
    qu'on n'a pas voulu. Et un identifiant absent mènerait à la LISTE —
    `…/formateurs/` est une URL valide — donc à un lien qui semble mener à la
    cible sans y mener.
  */
  const id = cibleId.trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return null;
  const segment = segmentCible(cibleType);
  if (segment === null) return null;
  return `${base}/${segment}/${id}`;
}
