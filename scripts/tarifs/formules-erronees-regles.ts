/**
 * 2026-10-08 (décision de Will) — les règles PURES de correction des anciennes formules à prix
 * erronés dans les textes DÉJÀ GÉNÉRÉS et stockés en base (articles, FAQ, connaissances, pages de
 * villes…). Partagées par `lister-formules-erronees.ts` (lecture seule) et
 * `corriger-formules-erronees.ts` (essai à blanc par défaut).
 *
 * Doctrine (relecture de a1, 08/10) : LISTER tout, ne CORRIGER automatiquement que le SÛR.
 *   - LISTÉ, toujours : tout ancien montant (2 450, 2 650, 3 250 €, en français ou en anglais),
 *     quel que soit son contexte ; tout nom de formule en contexte ; tout ancien jeton.
 *   - CORRIGÉ automatiquement, seulement :
 *       · les anciens jetons `{{price:intervention-essentielle…}}` → jeton de la matrice ;
 *       · les NOMS de formule EN CONTEXTE (« formule / formation / format / offre / journée
 *         Essentielle », majuscule de tête admise, guillemets « » avec ou sans espaces
 *         insécables ; « l'Essentielle » ; « Essentielle (1 jour) » ; idem Approfondie et
 *         Gagner du temps ; « Intervention Claude ») — « Une Analyse Approfondie » reste intacte ;
 *       · un MONTANT seulement s'il est COLLÉ à un nom de formule en contexte (même phrase, au
 *         plus `PROXIMITE` caractères entre les deux) : « formule Essentielle à 2 450 € ».
 *         Tout le reste — « Loyer de 3 250 € », « Prix : 2 450 € HT » seul, « Une formation IA
 *         coûte 2 450 € chez les concurrents », « Une Analyse Approfondie du budget : 2 450 € » —
 *         est rendu « à revoir », et Will tranche sur l'essai à blanc.
 *   - Une phrase s'arrête aux « . ! ? », aux sauts de ligne et aux balises de bloc (`</p>`,
 *     `<br>`, `</li>`…) : elle ne déborde jamais d'un paragraphe sur l'autre.
 *   - Un nombre plus long n'est jamais touché : « €2,450,000 », « 12 450 € », « 2 450 000 € ».
 * Aucun texte n'est supprimé ; la correction est IDEMPOTENTE.
 */
import { FORMATION_PRICE_MATRIX } from "../../src/content/pricing";
import { fmtNumber } from "../../src/lib/intl";

// Le montant SEUL, sans « HT » : la mention qui suit dans le texte d'origine est conservée.
const UN_JOUR = `${fmtNumber(FORMATION_PRICE_MATRIX.generale["1j"]!, "fr")} €`;
const DEUX_JOURS = `${fmtNumber(FORMATION_PRICE_MATRIX.generale["2j"]!, "fr")} €`;
const UN_JOUR_EN = `€${fmtNumber(FORMATION_PRICE_MATRIX.generale["1j"]!, "en")}`;
const DEUX_JOURS_EN = `€${fmtNumber(FORMATION_PRICE_MATRIX.generale["2j"]!, "en")}`;

/** Espace normale, insécable ou fine insécable. */
const E = "[ \\u00a0\\u202f]";
/** Séparateur de milliers : rien, espace(s) ou virgule/point. */
const MIL = `(?:${E}|[,.])?`;
/** Après le nombre : aucun autre chiffre, ni « ,000 » (un nombre plus long n'est pas le nôtre). */
const FIN_NOMBRE = "(?![0-9]|[,.][0-9]{3})";
/** Guillemets français, espaces insécables admises : « Essentielle », «Essentielle». */
const GO = `(?:«${E}?)?`;
const GF = `(?:${E}?»)?`;

/** Les montants anciens. `fr` : nombre puis devise ; `en` : devise puis nombre. */
const MONTANTS: ReadonlyArray<{ motif: RegExp; fr: boolean; un: boolean }> = [
  {
    motif: new RegExp(`(?:€|EUR)${E}?2${MIL}[46]50${FIN_NOMBRE}(?:\\.00)?`, "g"),
    fr: false,
    un: true,
  },
  {
    motif: new RegExp(`(?:€|EUR)${E}?3${MIL}250${FIN_NOMBRE}(?:\\.00)?`, "g"),
    fr: false,
    un: false,
  },
  {
    motif: new RegExp(
      `(?<![0-9][ \\u00a0\\u202f,.]?)\\b2${MIL}[46]50${FIN_NOMBRE}(?:[,.]00)?${E}?(?:€|EUR\\b|euros?\\b)`,
      "g",
    ),
    fr: true,
    un: true,
  },
  {
    motif: new RegExp(
      `(?<![0-9][ \\u00a0\\u202f,.]?)\\b3${MIL}250${FIN_NOMBRE}(?:[,.]00)?${E}?(?:€|EUR\\b|euros?\\b)`,
      "g",
    ),
    fr: true,
    un: false,
  },
];

/** [motif, remplacement, libellé du changement] — appliqués dans cet ordre, avant les montants. */
const REGLES: ReadonlyArray<readonly [RegExp, string, string]> = [
  // Jetons (ils contiennent les noms).
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
  // Noms — EN CONTEXTE seulement ; du plus précis au plus large.
  [/\b([Ll])['’]Essentielle\b/g, "$1a formation d'une journée", "nom"],
  [/\b([Ll])['’]Intervention Claude\b/g, "$1a formation d'une journée", "nom"],
  [/\b([Ll])['’]Approfondie\b/g, "$1a formation de deux jours", "nom"],
  [
    new RegExp(`\\bJournée ${GO}(?:Essentielle|Gagner du temps)${GF}`, "g"),
    "Formation d'une journée",
    "nom",
  ],
  [
    new RegExp(`\\bjournée ${GO}(?:Essentielle|Gagner du temps)${GF}`, "g"),
    "formation d'une journée",
    "nom",
  ],
  // Le nom qui précède est GARDÉ, majuscule comprise : « Formule Essentielle » → « Formule d'une journée ».
  [
    new RegExp(
      `\\b([Ff]ormule|[Ff]ormation|[Ff]ormat|[Oo]ffre)${E}${GO}(?:Essentielle|Gagner du temps)${GF}`,
      "g",
    ),
    "$1 d'une journée",
    "nom",
  ],
  [
    new RegExp(`\\b([Ff]ormule|[Ff]ormation|[Ff]ormat|[Oo]ffre)${E}${GO}Approfondie${GF}`, "g"),
    "$1 de deux jours",
    "nom",
  ],
  [/\bEssentielle (\((?:1 jour|1 journée|une journée)\))/g, "formation d'une journée $1", "nom"],
  [/\bApprofondie (\((?:2 jours|deux jours|2 journées)\))/g, "formation de deux jours $1", "nom"],
  [
    new RegExp(`«${E}?(?:Essentielle|Gagner du temps)${E}?»`, "g"),
    "« formation d'une journée »",
    "nom",
  ],
  [new RegExp(`«${E}?Approfondie${E}?»`, "g"), "« formation de deux jours »", "nom"],
  [/\b((?:deux|trois|quatre|cinq|\d+) )Essentielles\b/g, "$1formations d'une journée", "nom"],
  [/\b((?:deux|trois|quatre|cinq|\d+) )Approfondies\b/g, "$1formations de deux jours", "nom"],
  [/\bIntervention Claude\b/g, "formation d'une journée", "nom"],
];

/**
 * Les bornes de la phrase qui contient la position `i` : « . ! ? » suivis d'un blanc, saut de
 * ligne, ou balise de bloc (`</p>`, `<br>`, `</li>`, `</h2>`, `</div>`, `</td>`…) — une phrase ne
 * déborde jamais d'un paragraphe sur l'autre (relecture de a1, 08/10).
 */
function bornesPhrase(t: string, i: number): [number, number] {
  const fin = /[.!?](?=\s|$)|\n|<\/(?:p|li|h[1-6]|div|td|tr|blockquote)>|<br\s*\/?>/gi;
  let debut = 0;
  let m: RegExpExecArray | null;
  while ((m = fin.exec(t)) !== null) {
    if (m.index >= i) return [debut, m.index + m[0].length];
    debut = m.index + m[0].length;
  }
  return [debut, t.length];
}

/** Un nom de formule « collé » au montant : au plus tant de caractères entre les deux. */
const PROXIMITE = 60;

/** Les positions des NOMS DE FORMULE EN CONTEXTE (règles « nom ») dans le texte d'origine. */
function positionsDesNoms(t: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [motif, , libelle] of REGLES) {
    if (libelle !== "nom") continue;
    for (const m of t.matchAll(new RegExp(motif.source, motif.flags))) {
      out.push([m.index, m.index + m[0].length]);
    }
  }
  return out;
}

export interface Analyse {
  /** Le texte avec les seules corrections SÛRES appliquées. */
  texte: string;
  /** Les corrections appliquées. */
  changements: string[];
  /** Les anciens montants trouvés mais NON corrigés (contexte non sûr) : Will tranche. */
  aRevoir: string[];
}

/** Analyse UN texte : corrige le sûr, rend le reste « à revoir ». */
export function analyserTexte(texte: string): Analyse {
  const changements: string[] = [];
  const aRevoir: string[] = [];
  // 1) Les MONTANTS, lus sur le texte D'ORIGINE (positions des noms comprises).
  const noms = positionsDesNoms(texte);
  const trouves: Array<{ debut: number; fin: number; remplacement: string; un: boolean }> = [];
  for (const { motif, fr, un } of MONTANTS) {
    for (const m of texte.matchAll(new RegExp(motif.source, motif.flags))) {
      const debut = m.index;
      const fin = debut + m[0].length;
      if (trouves.some((x) => debut < x.fin && fin > x.debut)) continue; // chevauchement
      trouves.push({
        debut,
        fin,
        un,
        remplacement: fr ? (un ? UN_JOUR : DEUX_JOURS) : un ? UN_JOUR_EN : DEUX_JOURS_EN,
      });
    }
  }
  trouves.sort((a, b) => a.debut - b.debut);
  let t = "";
  let curseur = 0;
  for (const x of trouves) {
    const [pd, pf] = bornesPhrase(texte, x.debut);
    // SÛR seulement si un nom de formule en contexte est COLLÉ au montant, dans la même phrase.
    const colle = noms.some(
      ([a, b]) =>
        a >= pd &&
        b <= pf &&
        ((b <= x.debut && x.debut - b <= PROXIMITE) || (a >= x.fin && a - x.fin <= PROXIMITE)),
    );
    t += texte.slice(curseur, x.debut);
    if (colle) {
      t += x.remplacement;
      changements.push(x.un ? "montant 1 jour" : "montant 2 jours");
    } else {
      t += texte.slice(x.debut, x.fin);
      aRevoir.push(
        texte
          .slice(pd, pf)
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
    curseur = x.fin;
  }
  t += texte.slice(curseur);
  // 2) Les jetons et les NOMS en contexte.
  for (const [motif, remplacement, libelle] of REGLES) {
    const avant = t;
    t = t.replace(motif, remplacement);
    if (t !== avant) changements.push(libelle);
  }
  return { texte: t, changements, aRevoir };
}

/** Compatibilité : la correction SÛRE d'un texte. */
export function corrigerTexte(texte: string): { texte: string; changements: string[] } {
  const a = analyserTexte(texte);
  return { texte: a.texte, changements: a.changements };
}

/** Le texte porte-t-il une trace d'ancienne formule, corrigeable OU à revoir ? (pour LISTER) */
export function contientFormuleErronee(texte: string): boolean {
  const a = analyserTexte(texte);
  return a.changements.length > 0 || a.aRevoir.length > 0;
}

/** Analyse récursivement toutes les chaînes d'une valeur JSON (les clés ne sont jamais touchées). */
export function corrigerJson(valeur: unknown): {
  valeur: unknown;
  changements: string[];
  aRevoir: string[];
} {
  const changements: string[] = [];
  const aRevoir: string[] = [];
  const parcourir = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = analyserTexte(v);
      changements.push(...r.changements);
      aRevoir.push(...r.aRevoir);
      return r.texte;
    }
    if (Array.isArray(v)) return v.map(parcourir);
    if (v && typeof v === "object")
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, parcourir(x)]));
    return v;
  };
  return { valeur: parcourir(valeur), changements, aRevoir };
}

/** Un court extrait autour de la première trace (corrigée ou à revoir), pour la liste. */
export function extrait(texte: string, largeur = 90): string {
  const a = analyserTexte(texte);
  if (a.texte !== texte) {
    let k = 0;
    while (k < texte.length && texte[k] === a.texte[k]) k++;
    const debut = Math.max(0, k - largeur / 2);
    return texte
      .slice(debut, k + largeur)
      .replace(/\s+/g, " ")
      .trim();
  }
  return a.aRevoir[0] ? `À REVOIR : ${a.aRevoir[0].slice(0, largeur * 2)}` : "";
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
