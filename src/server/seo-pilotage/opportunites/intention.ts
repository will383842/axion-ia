/**
 * Intention des requêtes : règles lexicales françaises, sur un texte NON TRIÉ
 * (`normaliserRequete` trie les mots, ce qui casse « c'est quoi »).
 * Ordre : navigationnelle, transactionnelle, locale, commerciale,
 * informationnelle, sinon inconnue. `voice_search`, `ai_overview` et
 * `featured_snippet` ne sont pas des intentions.
 */
export type Intention =
  | "navigationnelle"
  | "transactionnelle"
  | "locale"
  | "commerciale"
  | "informationnelle"
  | "inconnue";

export interface DrapeauxIntention {
  readonly question: boolean;
  readonly definition: boolean;
  readonly liste: boolean;
  readonly local: boolean;
}

export interface ResultatIntention {
  readonly intention: Intention;
  readonly drapeaux: DrapeauxIntention;
}

export interface OptionsIntention {
  /** Villes normalisées (sans accent, minuscules). Par défaut : `VILLES_PAR_DEFAUT`. */
  readonly villes?: ReadonlySet<string>;
}

export function normaliserSansTri(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Amorce : le référentiel `City` est injecté par l'appelant. « grenoble » n'y figure volontairement pas. */
export const VILLES_PAR_DEFAUT: ReadonlySet<string> = new Set([
  "paris",
  "lyon",
  "marseille",
  "toulouse",
  "nice",
  "nantes",
  "montpellier",
  "strasbourg",
  "bordeaux",
  "lille",
  "rennes",
  "reims",
  "saint etienne",
  "tours",
  "orange",
  "dijon",
  "angers",
  "nimes",
  "annecy",
  "chambery",
]);

/** Villes qui sont aussi des mots courants : comptées seulement derrière une préposition de lieu. */
const HOMONYMES = new Set(["nice", "tours", "orange", "reims"]);
const PREPOSITION_LIEU = /(?:^| )(?:a|sur|pres de|dans|autour de|vers|en)$/;

export const MARQUES = ["axion", "axionia"] as const;

export function estRequeteMarque(requete: string): boolean {
  const t = ` ${normaliserSansTri(requete)} `;
  return MARQUES.some((m) => t.includes(` ${m} `)) || t.includes(" axion ia ");
}

const TRANSACTIONNEL =
  /(?:^| )(?:prix|tarifs?|devis|financements?|cout|couts|combien (?:coute|ca coute)|payer|acheter|commander)(?: |$)/;
const COMMERCIAL =
  /(?:^| )(?:meilleurs?|meilleures?|comparatif|comparaison|comparer|avis|alternatives?|vs|versus|top)(?: |$)/;
const DEFINITION =
  /(?:^| )(?:c est quoi|qu est ce que|qu est ce qu|definition|definir|signifie|signification)(?: |$)/;
const QUESTION =
  /^(?:comment|pourquoi|quand|quel|quelle|quels|quelles|qui|que|quoi|combien|est ce|peut on|faut il|ou)(?: |$)|c est quoi|qu est ce/;
const INFORMATIONNEL =
  /(?:^| )(?:comment|pourquoi|guide|tuto|tutoriel|exemples?|idees?|definition|principe|fonctionnement|fonctionne|apprendre|difference)(?: |$)/;
const LISTE =
  /(?:^| )(?:top \d+|\d+ (?:outils|idees|exemples|astuces|cas|usages|conseils|raisons)|liste)(?: |$)/;

function ville(t: string, villes: ReadonlySet<string>): boolean {
  for (const v of villes) {
    let depuis = 0;
    for (;;) {
      const i = ` ${t} `.indexOf(` ${v} `, depuis);
      if (i < 0) break;
      depuis = i + 1;
      if (!HOMONYMES.has(v)) return true;

      const avant = t.slice(0, i).trim();
      if (PREPOSITION_LIEU.test(avant)) return true;
    }
  }
  return false;
}

export function classerIntention(requete: string, opts: OptionsIntention = {}): ResultatIntention {
  const t = normaliserSansTri(requete);
  const local = ville(t, opts.villes ?? VILLES_PAR_DEFAUT);
  const drapeaux: DrapeauxIntention = {
    question: QUESTION.test(t),
    definition: DEFINITION.test(t),
    liste: LISTE.test(t),
    local,
  };
  let intention: Intention;
  if (estRequeteMarque(requete)) intention = "navigationnelle";
  else if (TRANSACTIONNEL.test(t)) intention = "transactionnelle";
  else if (local) intention = "locale";
  else if (COMMERCIAL.test(t)) intention = "commerciale";
  else if (drapeaux.question || drapeaux.definition || INFORMATIONNEL.test(t))
    intention = "informationnelle";
  else intention = "inconnue";
  return { intention, drapeaux };
}
