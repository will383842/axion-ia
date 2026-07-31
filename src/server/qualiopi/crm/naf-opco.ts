/**
 * Qualiopi — Inférence OPCO depuis le code NAF (APE).
 *
 * Map statique préfixe NAF (5 caractères exact ou 4 sans lettre) → OPCO.
 * Retourne `null` si inconnu (à déterminer manuellement côté CRM).
 *
 * Sources : liste officielle des branches par OPCO (DGEFP 2024).
 * Module PUR (pas d'import Prisma/next) — testable sans DB.
 *
 * ⚠️ ORDRE DE PRÉSÉANCE — l'OPCO est déterminé LÉGALEMENT par la convention
 * collective (IDCC), PAS par le code NAF. `prisma/schema.prisma` le dit
 * lui-même sur le champ `Client.idcc` : « saisi, NAF non fiable ». Le NAF n'est
 * qu'une heuristique de repli. Dans tout nouveau code, appeler `inferOpco()`
 * — qui interroge l'IDCC d'abord — et jamais `inferOpcoFromNaf()` seul.
 */

import type { OpcoId } from "@/server/qualiopi/financements/opco-referentiel";

/**
 * Map : code NAF exact (5 caractères, ex. "6201Z") → identifiant OPCO.
 *
 * ⚠️ COUVERTURE PARTIELLE, ASSUMÉE — 134 codes pour 5 OPCO sur les 11 du
 * référentiel (`opco-referentiel.ts`). Divisions NAF présentes : 24, 25, 28,
 * 41-43, 47, 55, 56, 58, 62, 63, 70, 71, 73, 85 (un seul code), 88, 96.
 * SIX OPCO ne sont atteignables par AUCUN code : OPCO EP, Mobilités, Afdas,
 * Uniformation, Ocapiat, OPCO Santé. Un client relevant de l'un d'eux ressort
 * donc `null`. C'est le comportement VOULU — « à déterminer » sur une
 * convention tripartite vaut mieux qu'un financeur faux — et c'est pourquoi
 * l'écran Clients DOIT conserver une saisie manuelle de secours
 * (`ClientBrancheForm`). Ne pas « compléter » cette map au jugé : chaque
 * ajout doit être adossé à une source citable.
 *
 * Couverture par OPCO :
 * - Atlas       : informatique, numérique, conseil (16)
 * - Akto        : HCR, services à la personne, organismes de formation (16)
 * - Opcommerce  : commerce de détail / gros (33)
 * - OPCO 2i     : industrie métallurgie (34)
 * - Constructys : construction / BTP (35)
 */
export const NAF_OPCO_MAP: Record<string, OpcoId> = {
  // ── Atlas (informatique, numérique, conseil, pub) ──
  "6201Z": "atlas",
  "6202A": "atlas",
  "6202B": "atlas",
  "6203Z": "atlas",
  "6209Z": "atlas",
  "6311Z": "atlas",
  "7022Z": "atlas",
  "7311Z": "atlas",
  // Édition logiciel / SaaS adjacent
  "5821Z": "atlas",
  "5829A": "atlas",
  "5829B": "atlas",
  "5829C": "atlas",
  // Traitement de données / hébergement
  "6312Z": "atlas",
  "6319Z": "atlas",
  // Ingénierie & études techniques (numérique)
  "7112B": "atlas",
  // Conseils en systèmes & logiciels
  "6204Z": "atlas",

  // ── Akto (HCR, services à la personne, propreté) ──
  "5510Z": "akto",
  "5520Z": "akto",
  "5530Z": "akto",
  "5590Z": "akto",
  "5610A": "akto",
  "5610B": "akto",
  "5610C": "akto",
  "5621Z": "akto",
  "5629A": "akto",
  "5629B": "akto",
  "5630Z": "akto",
  "9602A": "akto",
  "9602B": "akto",
  "8810A": "akto",
  "8810C": "akto",

  // ── Opcommerce (commerce de détail et gros) ──
  "4711A": "opcommerce",
  "4711B": "opcommerce",
  "4711C": "opcommerce",
  "4711D": "opcommerce",
  "4711E": "opcommerce",
  "4711F": "opcommerce",
  "4719A": "opcommerce",
  "4719B": "opcommerce",
  "4726Z": "opcommerce",
  "4741Z": "opcommerce",
  "4742Z": "opcommerce",
  "4743Z": "opcommerce",
  "4751Z": "opcommerce",
  "4752A": "opcommerce",
  "4752B": "opcommerce",
  "4753Z": "opcommerce",
  "4754Z": "opcommerce",
  "4759A": "opcommerce",
  "4759B": "opcommerce",
  "4771Z": "opcommerce",
  "4772A": "opcommerce",
  "4772B": "opcommerce",
  "4773Z": "opcommerce",
  "4774Z": "opcommerce",
  "4775Z": "opcommerce",
  "4776Z": "opcommerce",
  "4777Z": "opcommerce",
  "4778A": "opcommerce",
  "4778B": "opcommerce",
  "4779Z": "opcommerce",
  "4781Z": "opcommerce",
  "4782Z": "opcommerce",
  "4789Z": "opcommerce",

  // ── OPCO 2i (industrie métallurgie, chimie, plasturgie) ──
  "2562B": "opco2i",
  "2599B": "opco2i",
  "2849Z": "opco2i",
  "2410Z": "opco2i",
  "2420Z": "opco2i",
  "2431Z": "opco2i",
  "2432Z": "opco2i",
  "2433Z": "opco2i",
  "2434Z": "opco2i",
  "2441Z": "opco2i",
  "2442Z": "opco2i",
  "2443Z": "opco2i",
  "2444Z": "opco2i",
  "2445Z": "opco2i",
  "2446Z": "opco2i",
  "2451Z": "opco2i",
  "2452Z": "opco2i",
  "2453Z": "opco2i",
  "2454Z": "opco2i",
  "2511Z": "opco2i",
  "2512Z": "opco2i",
  "2521Z": "opco2i",
  "2529Z": "opco2i",
  "2530Z": "opco2i",
  "2540Z": "opco2i",
  "2550A": "opco2i",
  "2550B": "opco2i",
  "2561Z": "opco2i",
  "2562A": "opco2i",
  "2591Z": "opco2i",
  "2592Z": "opco2i",
  "2593Z": "opco2i",
  "2594Z": "opco2i",
  "2599A": "opco2i",

  // ── Constructys (BTP, construction) ──
  "4120A": "constructys",
  "4120B": "constructys",
  "4211Z": "constructys",
  "4212Z": "constructys",
  "4213A": "constructys",
  "4213B": "constructys",
  "4221Z": "constructys",
  "4222Z": "constructys",
  "4291Z": "constructys",
  "4299Z": "constructys",
  "4311Z": "constructys",
  "4312A": "constructys",
  "4312B": "constructys",
  "4313Z": "constructys",
  "4321A": "constructys",
  "4321B": "constructys",
  "4322A": "constructys",
  "4322B": "constructys",
  "4329A": "constructys",
  "4329B": "constructys",
  "4331Z": "constructys",
  "4332A": "constructys",
  "4332B": "constructys",
  "4332C": "constructys",
  "4333Z": "constructys",
  "4334Z": "constructys",
  "4339Z": "constructys",
  "4391A": "constructys",
  "4391B": "constructys",
  "4399A": "constructys",
  "4399B": "constructys",
  "4399C": "constructys",
  "4399D": "constructys",
  "4399E": "constructys",
  "7111Z": "constructys",

  // ── Enseignement (section 85) — UN SEUL code déclaré, à dessein ──
  // 8559A « Formation continue d'adultes » relève de la CCN des organismes de
  // formation (IDCC 1516), rattachée à AKTO. Les onze autres codes de la
  // section (8510Z→8553Z, 8559B, 8560Z) dépendent de leur convention collective
  // et se répartissent entre OPCO EP, Afdas et Uniformation : les ajouter au
  // jugé mettrait un financeur FAUX sur une pièce opposable à un auditeur.
  // Voir aussi NAF_PREFIX4_SANS_REPLI plus bas — sans quoi 8559B hériterait
  // d'AKTO par le repli de classe.
  "8559A": "akto",
} as const;

/**
 * Classes NAF (4 caractères) où le repli par classe est INTERDIT : leurs
 * sous-codes relèvent d'OPCO différents, seule la correspondance exacte à
 * 5 caractères y fait foi.
 *
 * « 8559 » : 8559A (formation continue d'adultes → AKTO) et 8559B (« Autres
 * enseignements » : langues, soutien scolaire, artistique, sportif → Afdas,
 * Uniformation ou OPCO EP selon la branche) ne partagent PAS le même OPCO.
 * Sans cette liste, déclarer 8559A suffirait à étiqueter 8559B en AKTO.
 */
export const NAF_PREFIX4_SANS_REPLI: ReadonlySet<string> = new Set(["8559"]);

/** Une entrée IDCC → OPCO, avec la référence qui l'établit. */
export interface IdccOpco {
  readonly opco: OpcoId;
  /**
   * Source traçable. NON décorative : cette valeur finit imprimée sur une
   * convention tripartite et un kit OPCO ; un auditeur Qualiopi (ind. 23/24,
   * veille légale) doit pouvoir remonter à la règle. N'ajouter AUCUNE entrée
   * sans source — un champ rempli sans fondement est plus dommageable en audit
   * qu'un « à déterminer » assumé.
   *
   * ⚠️ Pas de date de consultation figée ici : une date gelée dans le code
   * atteste une veille qui n'a pas lieu. La fraîcheur se tient dans le registre
   * de veille légale, qui est la pièce opposable.
   */
  readonly source: string;
}

/**
 * IDCC (4 chiffres) → OPCO. Source AUTORITAIRE : c'est la convention collective
 * qui rattache une entreprise à son OPCO, le NAF n'en est qu'un indice.
 */
export const IDCC_OPCO_MAP: Record<string, IdccOpco> = {
  "1516": {
    opco: "akto",
    source:
      "CCN des organismes de formation, IDCC 1516 — branche « Organismes de formation » rattachée à AKTO (akto.fr/nos-secteurs-activite ; opco.fr/trouver/ape-8559A/idcc-1516). À revérifier à chaque mise à jour du référentiel OPCO — registre de veille légale, ind. 23/24.",
  },
};

/**
 * Infère l'OPCO depuis un code NAF (APE). HEURISTIQUE de repli seulement :
 * préférer `inferOpco()`, qui interroge d'abord l'IDCC (source légale).
 *
 * - Correspondance exacte 5 caractères d'abord.
 * - Puis repli par classe (4 caractères), sauf classes ambiguës.
 * - `null` si inconnu, ou si `naf` est null/undefined/vide.
 *
 * @param naf  Code NAF/APE (ex. "6201Z" ; « 62.01Z » et « 62 01 Z » acceptés).
 */
export function inferOpcoFromNaf(naf: string | null | undefined): OpcoId | null {
  if (!naf) return null;
  // Retirer TOUS les séparateurs, pas seulement le premier : `replace(".", "")`
  // sans le drapeau /g laissait « 85.59.A » à moitié normalisé (« 8559.A »),
  // donc introuvable, donc silencieusement null.
  const normalized = naf.replace(/[\s.]/g, "").toUpperCase().trim();
  if (normalized.length === 0) return null;

  // Correspondance exacte (5 caractères)
  const exact = NAF_OPCO_MAP[normalized];
  if (exact !== undefined) return exact;

  // 🔴 GARDE DE LONGUEUR — le champ Zod est `max(6)` SANS `.min()` : « 85 » et
  // « 855 » sont des saisies acceptées. Sans ce test, `slice(0, 4)` renvoie la
  // saisie tronquée telle quelle et le repli ci-dessous rattrape la première
  // clé qui commence par là : toute la section Enseignement saisie en abrégé
  // basculerait en AKTO. Reproduit avant correctif.
  if (normalized.length < 4) return null;

  const prefix4 = normalized.slice(0, 4);
  if (NAF_PREFIX4_SANS_REPLI.has(prefix4)) return null;

  // Repli par classe NAF (4 premiers caractères).
  for (const [key, opco] of Object.entries(NAF_OPCO_MAP)) {
    if (key.startsWith(prefix4)) return opco;
  }

  return null;
}

/**
 * Infère l'OPCO depuis le code IDCC de la convention collective. Source
 * AUTORITAIRE — à préférer au NAF chaque fois qu'elle est renseignée.
 *
 * @param idcc  Code IDCC (ex. "1516" ; « 01516 » et « 1 516 » acceptés).
 */
export function inferOpcoFromIdcc(idcc: string | null | undefined): OpcoId | null {
  if (!idcc) return null;
  const chiffres = idcc.replace(/\D/g, "");
  if (chiffres.length === 0) return null;
  // Un IDCC tient sur 4 chiffres, parfois saisi avec un zéro de tête. On refuse
  // au-delà plutôt que de tronquer : « 11516 » n'est pas « 1516 », et deviner
  // ici reviendrait à désigner un financeur au hasard.
  if (chiffres.length > 5 || (chiffres.length === 5 && !chiffres.startsWith("0"))) return null;
  const cle = chiffres.padStart(4, "0").slice(-4);
  return IDCC_OPCO_MAP[cle]?.opco ?? null;
}

/**
 * Inférence combinée, à utiliser partout : IDCC prioritaire (la convention
 * collective détermine l'OPCO en droit), repli NAF (heuristique).
 *
 * Les deux clés sont REQUISES (valeurs nullables) et non optionnelles :
 * `exactOptionalPropertyTypes` est actif, une clé optionnelle obligerait chaque
 * appelant à un `?? null` supplémentaire pour compiler.
 */
export function inferOpco(input: {
  idcc: string | null | undefined;
  naf: string | null | undefined;
}): OpcoId | null {
  return inferOpcoFromIdcc(input.idcc) ?? inferOpcoFromNaf(input.naf);
}
