/**
 * 2026-10-08 (décision de Will) — les règles PURES de correction des anciennes formules à prix
 * erronés dans les textes DÉJÀ GÉNÉRÉS et stockés en base (articles, FAQ, connaissances, pages de
 * villes…). Partagées par `lister-formules-erronees.ts` (lecture seule) et
 * `corriger-formules-erronees.ts` (essai à blanc par défaut).
 *
 * Ce qui est remplacé, et RIEN d'autre (relecture de a1, 08/10 : jamais un mot hors contexte) :
 *   - les MONTANTS 2 450 / 2 650 € (une journée) et 3 250 € (deux jours), en français
 *     (« 2 450 € ») comme en anglais (« €2,450 »), SEULEMENT dans une phrase qui parle de
 *     formation (formation, formule, journée, jour, groupe, Essentielle…, training, day) — un
 *     « 2 450 € » de loyer ou de budget reste intact ;
 *   - les NOMS de formule EN CONTEXTE seulement : « formule / formation / format / offre /
 *     journée Essentielle », « l'Essentielle », « Essentielle (1 jour) », « « Essentielle » »,
 *     idem pour Approfondie et « Gagner du temps », et « Intervention Claude » (deux mots, la
 *     majuscule fait le nom). « Une Analyse Approfondie des données » reste intacte ;
 *   - les anciens jetons `{{price:intervention-essentielle…}}` → jeton de la matrice.
 * Aucun texte n'est supprimé ; la règle est IDEMPOTENTE (un texte corrigé ne change plus).
 */
import { FORMATION_PRICE_MATRIX } from "../../src/content/pricing";
import { fmtNumber } from "../../src/lib/intl";

const ESP = "[\\s\\u00a0\\u202f]?";
// Le montant SEUL, sans « HT » : la mention qui suit dans le texte d'origine (« HT », « par
// groupe »…) est conservée telle quelle — sinon « 2 450 € HT » deviendrait « … € HT HT ».
const UN_JOUR = `${fmtNumber(FORMATION_PRICE_MATRIX.generale["1j"]!, "fr")} €`;
const DEUX_JOURS = `${fmtNumber(FORMATION_PRICE_MATRIX.generale["2j"]!, "fr")} €`;
const UN_JOUR_EN = `€${fmtNumber(FORMATION_PRICE_MATRIX.generale["1j"]!, "en")}`;
const DEUX_JOURS_EN = `€${fmtNumber(FORMATION_PRICE_MATRIX.generale["2j"]!, "en")}`;
/** Séparateur de milliers : rien, espace, insécable, fine insécable, virgule ou point. */
const MIL = "[\\s\\u00a0\\u202f,.]?";

/** Une phrase qui parle de FORMATION : seule une telle phrase voit ses montants corrigés. */
const CONTEXTE_FORMATION =
  /formation|formule|journ[ée]e|\bjours?\b|\bgroupe|Essentielle|Approfondie|Intervention Claude|Gagner du temps|training|\bdays?\b/i;

/** Montants erronés, [motif, remplacement, libellé] — appliqués PHRASE PAR PHRASE, en contexte. */
const MONTANTS: ReadonlyArray<readonly [RegExp, string, string]> = [
  // Anglais d'abord : « €2,450 », « € 2,450 », « EUR 2,450 ».
  [new RegExp(`(?:€|EUR)${ESP}2${MIL}[46]50(?:\\.00)?\\b`, "g"), UN_JOUR_EN, "montant 1 jour"],
  [new RegExp(`(?:€|EUR)${ESP}3${MIL}250(?:\\.00)?\\b`, "g"), DEUX_JOURS_EN, "montant 2 jours"],
  // Français : « 2 450 € », « 2450 euros », « 2 650,00 € ».
  [
    new RegExp(`\\b2${MIL}[46]50(?:[,.]00)?${ESP}(?:€|EUR\\b|euros?\\b)`, "g"),
    UN_JOUR,
    "montant 1 jour",
  ],
  [
    new RegExp(`\\b3${MIL}250(?:[,.]00)?${ESP}(?:€|EUR\\b|euros?\\b)`, "g"),
    DEUX_JOURS,
    "montant 2 jours",
  ],
];

/** [motif, remplacement, libellé du changement] — appliqués dans cet ordre. */
const REGLES: ReadonlyArray<readonly [RegExp, string, string]> = [
  // Jetons d'abord (ils contiennent les noms).
  [
    /\{\{price:intervention-(?:essentielle|temps|claude)(\|[a-z]+)?\}\}/g,
    "{{price:formation-generale-1j$1}}",
    "jeton 1 jour",
  ],
  [
    /\{\{price:intervention-approfondie(\|[a-z]+)?\}\}/g,
    "{{price:formation-generale-2j$1}}",
    "jeton 2 jours",
  ],
  [
    /\{\{price:(essentielle|temps|claude)-standard(\|[a-z]+)?\}\}/g,
    "{{price:formation-generale-1j$2}}",
    "jeton 1 jour",
  ],
  [
    /\{\{price:approfondie-standard(\|[a-z]+)?\}\}/g,
    "{{price:formation-generale-2j$1}}",
    "jeton 2 jours",
  ],
  // Noms de formules — EN CONTEXTE seulement (relecture de a1) ; du plus précis au plus large.
  // « L'Essentielle » → « La formation… », « l'Essentielle » → « la formation… » (casse gardée).
  [/\b([Ll])['’]Essentielle\b/g, "$1a formation d'une journée", "nom"],
  [/\b([Ll])['’]Intervention Claude\b/g, "$1a formation d'une journée", "nom"],
  [/\b([Ll])['’]Approfondie\b/g, "$1a formation de deux jours", "nom"],
  // Le nom qui précède est GARDÉ : « format Approfondie » → « format de deux jours ».
  [/\bjournée (?:« ?)?Essentielle(?: ?»)?/g, "formation d'une journée", "nom"],
  [/\b(formule|formation|format|offre) (?:« ?)?Essentielle(?: ?»)?/g, "$1 d'une journée", "nom"],
  [/\b(formule|formation|format|offre) (?:« ?)?Approfondie(?: ?»)?/g, "$1 de deux jours", "nom"],
  [/\bjournée (?:« ?)?Gagner du temps(?: ?»)?/g, "formation d'une journée", "nom"],
  [
    /\b(formule|formation|format|offre) (?:« ?)?Gagner du temps(?: ?»)?/g,
    "$1 d'une journée",
    "nom",
  ],
  [/\bEssentielle (\((?:1 jour|1 journée|une journée)\))/g, "formation d'une journée $1", "nom"],
  [/\bApprofondie (\((?:2 jours|deux jours|2 journées)\))/g, "formation de deux jours $1", "nom"],
  [/« Essentielle »/g, "« formation d'une journée »", "nom"],
  [/« Approfondie »/g, "« formation de deux jours »", "nom"],
  [/« Gagner du temps »/g, "« formation d'une journée »", "nom"],
  [/\b((?:deux|trois|quatre|cinq|\d+) )Essentielles\b/g, "$1formations d'une journée", "nom"],
  [/\b((?:deux|trois|quatre|cinq|\d+) )Approfondies\b/g, "$1formations de deux jours", "nom"],
  [/\bIntervention Claude\b/g, "formation d'une journée", "nom"],
];

/** Corrige UN texte. Rend le texte et la liste des changements (vide : rien à faire). */
export function corrigerTexte(texte: string): { texte: string; changements: string[] } {
  let t = texte;
  const changements: string[] = [];
  for (const [motif, remplacement, libelle] of REGLES) {
    const avant = t;
    t = t.replace(motif, remplacement);
    if (t !== avant) changements.push(libelle);
  }
  // Montants : phrase par phrase, et seulement quand la phrase parle de formation.
  t = t.replace(/[^.!?\n]+[.!?]*/g, (phrase) => {
    if (!CONTEXTE_FORMATION.test(phrase)) return phrase;
    let p = phrase;
    for (const [motif, remplacement, libelle] of MONTANTS) {
      const avant = p;
      p = p.replace(motif, remplacement);
      if (p !== avant) changements.push(libelle);
    }
    return p;
  });
  return { texte: t, changements };
}

/** Le texte contient-il encore une trace d'ancienne formule (au sens des mêmes règles) ? */
export function contientFormuleErronee(texte: string): boolean {
  return corrigerTexte(texte).changements.length > 0;
}

/** Corrige récursivement toutes les chaînes d'une valeur JSON (les clés ne sont jamais touchées). */
export function corrigerJson(valeur: unknown): { valeur: unknown; changements: string[] } {
  const changements: string[] = [];
  const parcourir = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = corrigerTexte(v);
      changements.push(...r.changements);
      return r.texte;
    }
    if (Array.isArray(v)) return v.map(parcourir);
    if (v && typeof v === "object")
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, parcourir(x)]));
    return v;
  };
  return { valeur: parcourir(valeur), changements };
}

/** Un court extrait autour de la première trace, pour la liste. */
export function extrait(texte: string, largeur = 90): string {
  const corrige = corrigerTexte(texte).texte;
  if (corrige === texte) return "";
  let k = 0;
  while (k < texte.length && texte[k] === corrige[k]) k++;
  const debut = Math.max(0, k - largeur / 2);
  return texte
    .slice(debut, k + largeur)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Les tables et colonnes de CONTENU PUBLIC généré. Liste FERMÉE (les noms entrent dans du SQL :
 * jamais une valeur venue de l'extérieur). `json` : la colonne est un jsonb, corrigée chaîne par
 * chaîne.
 */
export const COLONNES: ReadonlyArray<{
  table: string;
  colonnes: ReadonlyArray<{ nom: string; json?: true }>;
}> = [
  {
    table: "article_translations",
    colonnes: [
      { nom: "title" },
      { nom: "excerpt" },
      { nom: "body" },
      { nom: "body_json", json: true },
      { nom: "body_text" },
      { nom: "meta_description" },
    ],
  },
  {
    table: "faqs",
    colonnes: [
      { nom: "question_fr" },
      { nom: "answer_fr" },
      { nom: "answer_en" },
      { nom: "meta_description" },
    ],
  },
  {
    table: "help_article_translations",
    colonnes: [
      { nom: "title" },
      { nom: "excerpt" },
      { nom: "body" },
      { nom: "body_json", json: true },
      { nom: "body_text" },
      { nom: "meta_description" },
    ],
  },
  {
    table: "knowledge_translations",
    colonnes: [
      { nom: "title" },
      { nom: "excerpt" },
      { nom: "body" },
      { nom: "body_json", json: true },
      { nom: "body_text" },
      { nom: "meta_description" },
    ],
  },
  {
    table: "press_release_translations",
    colonnes: [{ nom: "title" }, { nom: "dek" }, { nom: "body" }, { nom: "meta_description" }],
  },
  {
    table: "generated_ville_copies",
    colonnes: [
      { nom: "pitch_fr" },
      { nom: "direct_answer_fr" },
      { nom: "ecosystem_fr" },
      { nom: "services_context_json", json: true },
      { nom: "faq_geolocalisee_json", json: true },
    ],
  },
  { table: "generated_ville_ecosystem", colonnes: [{ nom: "content" }] },
  { table: "generated_ville_secteurs", colonnes: [{ nom: "content" }] },
  { table: "generated_ville_faq_extended", colonnes: [{ nom: "faqs", json: true }] },
  { table: "generated_ville_cas_usage", colonnes: [{ nom: "cases", json: true }] },
];

/**
 * Le filtre SQL large (expression régulière Postgres) qui présélectionne les lignes à examiner ;
 * la décision fine est prise ensuite par `contientFormuleErronee`. Espaces normale, insécable et
 * fine insécable admises dans les montants.
 */
export const MOTIF_SQL =
  "(Essentielle|Approfondie|Intervention Claude|Gagner du temps|price:intervention-(essentielle|temps|approfondie|claude)|(essentielle|temps|claude|approfondie)-standard|2[ \u00a0\u202f,.]?[46]50|3[ \u00a0\u202f,.]?250)";
