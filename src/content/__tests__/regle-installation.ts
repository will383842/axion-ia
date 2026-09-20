/**
 * Règle « rien à installer » (décision de Will du 2026-09-19 : Zoom, depuis le
 * navigateur, rien à installer ni sur place ni à distance), partagée par deux
 * gardes :
 *  - `le-materiel-annonce-est-le-meme-partout.spec.ts` — FAQ, fiches (texte
 *    affiché et JSON-LD), page `/formations/entreprise` ;
 *  - `src/server/qualiopi/documents/templates/__tests__/le-dispositif-d-assistance-est-imprime.spec.tsx`
 *    — convocation et livret RENDUS.
 *
 * Toute proposition qui contient « install » porte une NÉGATION dans la même
 * proposition ; bornée au présentiel, elle couvre aussi le distanciel. Seules
 * exceptions : les sens figurés ou hors session, listés dans `FIGURES`.
 *
 * 🔴 La version précédente listait les tournures FAUTIVES : « il faut
 * installer l'application Zoom » passait en exit 0 (revues simplicité
 * 5256426101 et exactitude 5256482948). On liste désormais ce qui est PERMIS.
 *
 * Module de TEST (hors `*.spec.ts`) : importé par les deux gardes, jamais par
 * le code de production.
 */

/** Une négation, dans la proposition même. */
const NEGATION =
  /\b(?:rien|aucune?s?|sans|pas|ni|jamais|no|not|nothing|without|never|none)\b|n['’]t\b/i;
/** Ce qui borne la proposition au présentiel. */
const BORNE_SUR_PLACE = /sur place|dans vos locaux|en présentiel|on site|in person/i;
/** Ce qui l'étend au distanciel. */
const COUVRE_LA_DISTANCE =
  /ni (?:sur place ni )?à distance|sur place comme à distance|(?:on site|in person),? (?:or|and|as well as) remotely|nor remotely/i;

/**
 * Sens FIGURÉS ou hors session de « installer », relevés le 2026-09-19 dans le
 * périmètre de la règle : on installe une pratique, un réflexe ; on installe
 * des modèles chez le client. Aucun ne demande au participant d'installer quoi
 * que ce soit. Le fragment est RETIRÉ de la proposition avant contrôle : une
 * consigne qui l'accompagnerait (« installez Zoom et installez une pratique
 * commune ») rougit quand même. Liste tapée à la main, et c'est voulu : un
 * nouvel emploi de « install » doit être lu par quelqu'un.
 */
export const FIGURES: readonly string[] = [
  // Une pratique, une méthode, des réflexes, des usages : sens figuré.
  "installe une pratique",
  "installent une pratique",
  "installer une pratique",
  "installe une méthode",
  "installe ensuite une méthode",
  "installe les premiers usages",
  "réflexes s'installent",
  "l'autonomie s'installe",
  "vitesse d'installation",
  "ce qu'axion-ia installe",
  "usages qu'il installe",
  "usages installés",
  "usages à installer",
  "automatisation à installer",
  "ce qu'on installe lundi",
  "évaluer, installer",
  // Chez le client, par Axion IA : rien que le participant installe.
  "modèles installés sur vos propres serveurs",
  "modèles ouverts installés chez vous",
  "stack open-source installée chez vous",
  // Un exercice : faire rédiger une procédure d'installation par l'IA.
  "procédure d'installation",
];

/** Découpe en propositions : « Rien à installer : sur place, … ; à distance, … ». */
export function propositions(texte: string): string[] {
  return texte
    .replace(/\\[nrt]/g, " ")
    .replace(/[\s\u00a0\u202f]+/g, " ")
    .split(/(?<=[.!?])\s+|\s*[;:—(){}[\]]\s*|\s+-\s+/);
}

/** Retire les sens figurés déclarés. */
function sansFigures(proposition: string): string {
  let reste = proposition.toLowerCase();
  for (const figure of FIGURES) reste = reste.split(figure.toLowerCase()).join(" ");
  return reste;
}

/**
 * La règle, en une fonction : les propositions d'un texte qui parlent
 * d'installer sans le nier, ou qui ne le nient que sur place.
 */
export function fautesInstallation(textes: readonly string[]): string[] {
  return textes.flatMap(propositions).filter((p) => {
    const reste = sansFigures(p);
    if (!/install/i.test(reste)) return false;
    if (!NEGATION.test(reste)) return true;
    return BORNE_SUR_PLACE.test(reste) && !COUVRE_LA_DISTANCE.test(reste);
  });
}
