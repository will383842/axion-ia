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

import { DISTANCIEL_VISIO } from "../formations/materiel";

/**
 * Le nom de l'outil de visioconférence, DÉRIVÉ de la SSOT du matériel : c'est
 * le premier mot de `DISTANCIEL_VISIO` (« Zoom, depuis le navigateur… »). Le
 * jour où Will change d'outil, cette règle le suit sans qu'on y pense — c'est
 * précisément la substitution qu'une garde épinglée sur un nom en dur ne voit
 * pas (constat du 2026-09-20 sur la SSOT sous-traitants).
 */
const OUTIL_VISIO = DISTANCIEL_VISIO.split(/[\s,]+/)[0] ?? "";

/** Une négation, dans la proposition même. */
const NEGATION =
  /\b(?:rien|aucune?s?|sans|pas|ni|jamais|no|not|nothing|without|never|none)\b|n['’]t\b/i;
/**
 * Négations qui portent sur AUTRE CHOSE que l'installation, et qui blanchissaient
 * donc une consigne fautive. Mesurées par les lentilles exactitude et simplicité
 * le 2026-09-20 : « N'oubliez pas d'installer Zoom avant la session. » passait.
 *
 * 🔑 Liste de CONTRE-exemples, pas de tournures fautives : la règle reste « toute
 * proposition qui dit d'installer porte une négation » ; on retire seulement à
 * trois formules le droit de compter comme telle. Une quatrième devra être lue
 * par quelqu'un, et c'est voulu.
 */
const NEGATION_INOPERANTE =
  /n['’](?:oubliez|oublie|hésitez|hésite)\b|\bdon['’]?t forget\b|\bn['’]hésitez\b/i;

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
  // Élargi le 2026-09-20 : le texte réel écrit « modèles open-source comme Llama
  // ou Mistral installés sur vos propres serveurs » — le fragment d'origine,
  // plus étroit, ne le couvrait pas. C'est Axion-IA qui installe, chez le
  // client, sur ses serveurs : rien que le participant ait à installer.
  "installés sur vos propres serveurs",
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

/**
 * Le morceau de proposition qui porte réellement « install », entre virgules.
 *
 * 🔑 POURQUOI LA VIRGULE NE DÉCOUPE PAS LES PROPOSITIONS. Essayé le 2026-09-20,
 * et REJETÉ sur mesure : « Sur place, rien à installer : un smartphone suffit. »
 * doit rougir (la négation ne vaut que sur place, le distanciel reste muet).
 * Couper à la virgule sépare « Sur place » de « rien à installer », et la garde
 * ne voit plus la borne — trois de ses propres cas sont passés au vert.
 *
 * La virgule sert donc à UNE seule chose : savoir si la négation porte sur
 * l'installation ou sur autre chose. « Pas besoin d'être technicien, installez
 * l'application Zoom. » nie la technicité, pas l'installation. La borne
 * présentiel/distance, elle, continue de se lire sur la proposition ENTIÈRE.
 */
function segmentsPortantInstall(proposition: string): string[] {
  const segments = proposition.split(/\s*,\s*/).filter((seg) => /install/i.test(seg));
  return segments.length > 0 ? segments : [proposition];
}

/**
 * Une clause d'exception reprend d'une main ce que la négation donnait de
 * l'autre : « Rien à installer, sauf l'application Zoom. » Relevé par la
 * lentille exactitude le 2026-09-20 — la négation et l'exception vivent dans
 * deux segments différents, aucun des deux n'est fautif pris isolément.
 */
const EXCEPTION =
  /\bsauf\b|\bhormis\b|\bà l['’]exception\b|\bexcept\b|\bapart from\b|\bother than\b/i;

/**
 * Retire les sens figurés déclarés — SAUF ceux qui visent l'outil.
 *
 * 🔑 Un figuré ne couvre que ce qu'il dit. « Suivez la procédure d'installation
 * de Zoom » emprunte le fragment « procédure d'installation » pour donner une
 * consigne bien réelle : le nom de l'outil le suit. « Avec Zoom, l'autonomie
 * s'installe en trois séances » ne demande rien à personne, bien que la phrase
 * nomme l'outil elle aussi.
 *
 * On regarde donc ce qui SUIT le fragment, pas la phrase entière. Première
 * version (2026-09-20) : désactiver toutes les figures dès que le texte nommait
 * l'outil. Elle échouait FERMÉ — deux figures déjà déclarées viraient au rouge,
 * et l'échappatoire aurait été inopérante le jour où elle sert, sans laisser
 * de trace. Mesuré par la lentille simplicité avant la fusion.
 */
const PORTEE_DU_FIGURE = 40;

function sansFigures(proposition: string, outil = ""): string {
  let reste = proposition.toLowerCase();
  const cible = outil.toLowerCase();
  for (const figure of FIGURES) {
    const frag = figure.toLowerCase();
    let i = reste.indexOf(frag);
    while (i !== -1) {
      const suite = reste.slice(i + frag.length, i + frag.length + PORTEE_DU_FIGURE);
      // Le figuré vise l'outil : il ne blanchit rien, on laisse le texte tel quel.
      if (cible.length > 0 && suite.includes(cible)) {
        i = reste.indexOf(frag, i + frag.length);
        continue;
      }
      reste = reste.slice(0, i) + " " + reste.slice(i + frag.length);
      i = reste.indexOf(frag, i + 1);
    }
  }
  return reste;
}

/**
 * La règle, en une fonction : les propositions d'un texte qui parlent
 * d'installer sans le nier, ou qui ne le nient que sur place.
 */
export function fautesInstallation(textes: readonly string[]): string[] {
  return textes.flatMap((texte) => {
    // 🔑 Un sens figuré ne couvre JAMAIS un texte qui NOMME l'outil de
    // visioconférence. Sans cela, « Suivez la procédure d'installation de Zoom
    // avant la session. » sortait vert : le fragment figuré emportait le seul
    // « install », et il ne restait plus rien à juger.
    //
    // Le nom de l'outil se cherche dans le TEXTE ENTIER, pas dans la
    // proposition : la virgule sépare la consigne de sa cible (« des usages à
    // installer sur votre poste, à savoir Zoom »), et une garde qui regarde
    // chaque morceau isolément ne voit ni l'un ni l'autre.
    const nommeLOutil =
      OUTIL_VISIO.length > 0 && texte.toLowerCase().includes(OUTIL_VISIO.toLowerCase());
    return propositions(texte).filter((p) => {
      // Quand le texte nomme l'outil, les figurés restent utilisables — mais
      // aucun d'eux ne couvre un fragment que le nom de l'outil suit.
      const reste = sansFigures(p, nommeLOutil ? OUTIL_VISIO : "");
      if (!/install/i.test(reste)) return false;
      // La négation doit porter sur l'installation elle-même — pas sur la
      // difficulté, pas sur le niveau requis, pas sur un oubli.
      // Une exception annule la négation, où qu'elle soit dans la proposition.
      if (EXCEPTION.test(reste) && NEGATION.test(reste)) return true;
      // Chaque segment qui parle d'installer doit porter sa propre négation :
      // « Aucune installation n'est requise, sauf Zoom qu'il faut installer. »
      const porteurs = segmentsPortantInstall(reste);
      if (porteurs.some((seg) => !NEGATION.test(seg) || NEGATION_INOPERANTE.test(seg))) return true;
      // La borne présentiel/distance se lit sur la proposition entière.
      return BORNE_SUR_PLACE.test(reste) && !COUVRE_LA_DISTANCE.test(reste);
    });
  });
}
