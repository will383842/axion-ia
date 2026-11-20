/**
 * Porte 2 du retrait des mentions de financement : contrôle LEXICAL strict d'un texte public.
 *
 * Module à part (et non dans `plan.ts`) : la même règle s'impose aux overrides humains (`plan.ts`) ET au
 * moteur automatique (`regles.ts`, essai à blanc n° 2, B1). `plan.ts` importe `regles.ts` ; loger la
 * porte dans `plan.ts` ferait un import circulaire. Ce module n'importe rien.
 */

/**
 * Familles de la porte 2 (contre-audit v3) : on REFUSE la famille entière, puis on admet une courte liste
 * d'emplois explicitement non financiers. Un filtre « mots exacts suivis de n'importe quoi » ne ferme que
 * les exemples cités.
 */

/** « prise(s) en charge », « prendrait en charge », « prise intégralement en charge », « prise-en-charge ». */
const PRISE_EN_CHARGE =
  "\\b(?:pr[ie]\\w*|pren\\w*)(?:[\\s-]+[^\\s.,;:!?\\n]+){0,3}?[\\s-]+en[\\s-]+charges?\\b";
/** Fin de groupe qui clôt un emploi non financier (« … est rapide », « … se fait », « … par l'équipe »). */
const FIN_DE_GROUPE = "(?:\\s*(?:[.,;:!?)]|$)|\\s+(?:est|sont|se|en|et|par\\s+l['’]équipe)\\b)";
const COMPLEMENT_NON_FINANCIER =
  "(?:(?:des?|du|d['’]|de\\s+la|un|une|le|la|les)\\s*)?(?:appels?|tickets?|incidents?|requ[êe]tes?|clients?|patients?|demandes?|projets?)";
/**
 * Emplois NON financiers admis, listés un à un : un complément de la liste (appels, tickets, incidents,
 * requêtes, clients, patients, demandes, projet(s)), éventuellement suivi d'un seul mot, puis une fin de
 * groupe ; ou « rapide / immédiate / technique » (« technique du projet ») suivi d'une fin de groupe.
 * « rapide de vos frais » et « des projets de formation » ne ferment pas le groupe : refusés.
 */
const PEC_ADMISE =
  "(?:\\s+(?:" +
  COMPLEMENT_NON_FINANCIER +
  "(?:\\s+[a-zà-ÿ]+)?|(?:rapide|imm[ée]diate|technique)(?:\\s+du\\s+projet)?|l['’]int[ée]gralit[ée]\\s+de\\s+la\\s+partie\\s+technique)" +
  FIN_DE_GROUPE +
  ")";
/** Terme budgétaire dans la même phrase qu'« en charge » : refus, même pour un emploi de la liste. */
const PEC_ET_BUDGET =
  "(?:^|[.!?]\\s+)(?=[^.!?\\n]*\\ben[\\s-]+charge\\b)[^.!?\\n]*\\b(?:formations?|frais|co[uû]ts?|employeurs?|budgets?|tarifs?)\\b";

/** Un seul « financ… » est admis quand il désigne le SECTEUR d'activité (liste fermée, audit v3). */
const ADJ = "financi(?:er|[èe]re|ers|[èe]res)\\b";
const SECTEUR_AVANT =
  "(?:secteurs?|reporting|impacts?|donn[ée]es|analyses?|rapports?|pr[ée]visions?|engagements?|b[ée]n[ée]fices?|directeurs?|directrices?|int[ée]r[êe]ts?)\\s+(?:non\\s+)?";
const FINANCE_SECTEUR =
  "(?:(?<=(?:^|\\n))finance(?=\\s*[:,]|\\s+et\\b)" +
  "|(?<=(?:(?<![a-zà-ÿ])(?:la|en|de|du|des|et|ou|[ée]quipes?|fonctions?|m[ée]tiers?|secteurs?|banques?|assurances?)\\s+|[(,]\\s*))finance\\b" +
  "|finance(?=\\s+d['’]entreprise\\b)" +
  "|(?<=\\b" +
  SECTEUR_AVANT +
  ")" +
  ADJ +
  "|" +
  "financi(?:er|[èe]re|ers|[èe]res)(?=\\s+(?:secteur|reporting|donn[ée]es|analyses?|rapports?|pr[ée]visions?|impact|b[ée]n[ée]fices?|engagement)))";

/**
 * Interdits PUBLICS : contrôle LEXICAL strict d'un override (porte 2). Plus strict que les règles de
 * réécriture, qui laissent passer « France Travail » sans marqueur de financement (A4).
 * - « prise(s) en charge » et « à la charge de » : refusés partout, sauf emplois non financiers listés
 *   (`PEC_ADMISE`) et sans terme budgétaire dans la phrase (`PEC_ET_BUDGET`).
 * - « financ… » : refusé sous toutes ses formes (verbe, adverbe, « ressources / participation financière »),
 *   sauf les emplois de secteur de `FINANCE_SECTEUR` (« la finance », « directeur financier »…).
 * - « rembours… », « éligib… », « plan de développement des compétences » : refusés sans complément exigé.
 */
export const INTERDITS_PUBLICS = new RegExp(
  [
    "\\b(?:OPCOs?|OPCA|O\\.P\\.C\\.O\\.)(?![\\w])",
    "qualiopi",
    "\\bCPF\\b",
    "compte[\\s-]+personnel[\\s-]+de[\\s-]+formation",
    "personal training account",
    "mon[\\s-]?compte[\\s-]?formation",
    "france[\\s-]+travail",
    "p[ôo]le[- ]emploi",
    "\\bAIF\\b",
    // V3-2 : toute la famille « financ… » (finançait, financièrement, ressources financières, cofinancé…),
    // hors emplois de secteur.
    "(?!" + FINANCE_SECTEUR + ")(?:\\b|(?<=co|auto-?))finan[cç]\\w*",
    // Verbe « financer » suivi d'un déterminant, même si « finance » est précédé d'un mot admis (« en finance une part »).
    "\\bfinances?\\s+(?:(?:la|les|le|leurs?|votre|vos|son|sa|ses|une|des|cette|ces|tout|ta|tes|ton|notre|nos)\\b|l['’]|jusqu|\\d|[àa]\\s+(?:hauteur|100|\\d)|en\\s+partie|int[ée]gral|totalement|enti[èe]rement)",
    "op[ée]rateurs?[\\s-]+de[\\s-]+comp[ée]tences",
    "rembours\\w*",
    "[ée]ligib\\w*",
    "plan\\s+de\\s+d[ée]veloppement\\s+des\\s+comp[ée]tences",
    "\\bfund(?:s|ing|ed)?\\b",
    "subvention",
    "subrogation",
    "\\bEDOF\\b",
    "FNE[- ]Formation",
    "datadock",
    "(?:aides?|appuis?|leviers?|dispositifs?|soutiens?)\\s+financi",
    // V3-1 : « prise(s) en charge » sous TOUTES ses formes, sauf emploi non financier listé.
    PRISE_EN_CHARGE + "(?!" + PEC_ADMISE + ")",
    PEC_ET_BUDGET,
    "reste[\\s-]+[àa][\\s-]+charge",
    "[àa]\\s+la\\s+charge\\s+d",
    "[àa]\\s+(?:sa|votre|vos|leur|leurs|ma|mon)\\s+charge",
    // V4-1 : la famille « aide(s) » au sens financement (« l'Aide Individuelle à la Formation », « aides
    // régionales », « dispositifs d'aide »). Le verbe « aide à / aide les » n'est pas touché.
    "\\baides\\b",
    "\\baide\\s+(?:individuelle|r[ée]gionale|publique|de\\s+l['’][ée]tat|[àa]\\s+la\\s+formation|au\\s+(?:financement|diagnostic))",
    "dispositifs?\\s+d['’]aide",
    // V4-2 : reprises indirectes « couvrent tout ou partie des frais », « réduire le coût de la formation ».
    "tout\\s+ou\\s+partie\\s+d(?:es|u)\\s+(?:frais|co[uû]ts?)",
    "\\b(?:dispositifs?|options?|leviers?|aides?)\\b[^.!?\\n]{0,60}\\b(?:r[ée]duire|all[ée]ger|couvr\\w*)\\b[^.!?\\n]{0,30}\\b(?:co[uû]ts?|frais)",
    "assum\\w*\\s+la\\s+charge",
    // V5-1 : « dispositif(s) » repris au sens financement, « mobilisable / mobilisation ». `adapt\\w*` et non
    // `adapt[ée]s?\\b` : sans drapeau `u`, `é` n'est pas un caractère de mot et `adapté\\b` ne correspond jamais.
    "\\bmobilis(?:ables?|ation)\\b|\\bpeu(?:ven)?t\\s+mobiliser\\s*:",
    "\\b(?:ce|cet|ces)\\s+dispositifs?\\b(?!\\s+(?:de\\s+suivi|consulaires|p[ée]dagogiques?))",
    "\\bdispositifs?\\s+(?:(?:le|les)\\s+plus\\s+|locaux\\s+)?adapt\\w*|\\b(?:bons?|meilleurs?)\\s+dispositifs?\\b|identification\\s+d(?:u|es)\\s+dispositifs?",
    "\\bdispositifs?\\s+(?:disponibles|compl[ée]mentaires|publics)\\b|\\bdispositifs?\\s+d['’]accompagnement\\b|\\bdispositifs?\\s+de\\s+France\\s+Num",
    "\\bappels?\\s+[àa]\\s+projets?\\b|certification\\s+qualit[ée]\\s+via",
  ].join("|"),
  "i",
);

/** Tirets Unicode ramenés au tiret ASCII, espaces insécables à l'espace (sauts de ligne conservés). */
export function normaliserPourPorte2(t: string): string {
  return t
    .normalize("NFC")
    .replace(/[‐-―­]/g, "-")
    .replace(/[^\S\n]+/g, " ");
}
