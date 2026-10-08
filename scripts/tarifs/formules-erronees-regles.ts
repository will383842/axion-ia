/**
 * 2026-10-08 (décision de Will) — les règles PURES de correction des anciennes formules à prix
 * erronés dans les textes DÉJÀ GÉNÉRÉS et stockés en base (articles, FAQ, connaissances, pages de
 * villes…). Partagées par `lister-formules-erronees.ts` (lecture seule) et
 * `corriger-formules-erronees.ts` (essai à blanc par défaut).
 *
 * Ce qui est remplacé, et RIEN d'autre :
 *   - les montants « 2 450 € », « 2 650 € » (une journée) → prix d'une journée de la matrice ;
 *     « 3 250 € » (deux jours) → prix de deux jours de la matrice ;
 *   - les noms « Essentielle », « Gagner du temps » (comme NOM de formule, avec majuscule et
 *     précédé de « formation », « format » ou « journée »), « Intervention Claude »,
 *     « Approfondie » → le vocabulaire du catalogue ;
 *   - les anciens jetons `{{price:intervention-essentielle…}}` → jeton de la matrice.
 * Aucun texte n'est supprimé ; la règle est IDEMPOTENTE (un texte corrigé ne change plus).
 */
import { FORMATION_PRICE_MATRIX, formatAmount } from "../../src/content/pricing";

const ESP = "[\\s\\u00a0\\u202f]?";
const UN_JOUR = formatAmount(FORMATION_PRICE_MATRIX.generale["1j"]!, "fr");
const DEUX_JOURS = formatAmount(FORMATION_PRICE_MATRIX.generale["2j"]!, "fr");

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
  // Montants.
  [
    new RegExp(`\\b2${ESP}[46]50(?:[,.]00)?${ESP}(?:€|EUR\\b|euros?\\b)`, "g"),
    UN_JOUR,
    "montant 1 jour",
  ],
  [
    new RegExp(`\\b3${ESP}250(?:[,.]00)?${ESP}(?:€|EUR\\b|euros?\\b)`, "g"),
    DEUX_JOURS,
    "montant 2 jours",
  ],
  // Noms de formules (du plus précis au plus large).
  // « L'Essentielle » → « La formation… », « l'Essentielle » → « la formation… » (casse gardée).
  [/\b([Ll])['’]Essentielle\b/g, "$1a formation d'une journée", "nom"],
  [/\b([Ll])['’]Intervention Claude\b/g, "$1a formation d'une journée", "nom"],
  [/\b([Ll])['’]Approfondie\b/g, "$1a formation de deux jours", "nom"],
  [/\bformation Essentielle\b/g, "formation d'une journée", "nom"],
  [/\b(?:journée|format) Essentielle\b/g, "formation d'une journée", "nom"],
  [/\bEssentielles\b/g, "formations d'une journée", "nom"],
  [/\bEssentielle\b/g, "formation d'une journée", "nom"],
  [/\b(?:formation|format|journée) « ?Gagner du temps »?/g, "formation d'une journée", "nom"],
  [/\bIntervention Claude\b/g, "formation d'une journée", "nom"],
  [/\bformation Approfondie\b/g, "formation de deux jours", "nom"],
  [/\bApprofondies\b/g, "formations de deux jours", "nom"],
  [/\bApprofondie\b/g, "formation de deux jours", "nom"],
];

/** Le texte contient-il encore une trace d'ancienne formule ? */
export function contientFormuleErronee(texte: string): boolean {
  return REGLES.some(([motif]) =>
    new RegExp(motif.source, motif.flags.replace("g", "")).test(texte),
  );
}

/** Corrige UN texte. Rend le texte et la liste des changements (vide : rien à faire). */
export function corrigerTexte(texte: string): { texte: string; changements: string[] } {
  let t = texte;
  const changements: string[] = [];
  for (const [motif, remplacement, libelle] of REGLES) {
    const avant = t;
    t = t.replace(motif, remplacement);
    if (t !== avant) changements.push(libelle);
  }
  return { texte: t, changements };
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
  for (const [motif] of REGLES) {
    const m = new RegExp(motif.source, motif.flags.replace("g", "")).exec(texte);
    if (m) {
      const debut = Math.max(0, m.index - largeur / 2);
      return texte
        .slice(debut, m.index + m[0].length + largeur / 2)
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  return "";
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
  "(Essentielle|Approfondie|Intervention Claude|Gagner du temps|price:intervention-(essentielle|temps|approfondie|claude)|(essentielle|temps|claude|approfondie)-standard|2[ \u00a0\u202f]?[46]50|3[ \u00a0\u202f]?250)";
