/**
 * Retrait des mentions de financement (blog + offres d'emploi) — règles PURES.
 *
 * Décision du fondateur (18/11/2026) : Axion-IA ne propose ni OPCO, ni CPF, ni France Travail,
 * ni Qualiopi. On MODIFIE les textes publiés (jamais de suppression), même URL.
 * Plan : `geo/PLAN-RETRAIT-FINANCEMENT.md` (dépôt axion-plans-prive).
 *
 * Ce fichier ne touche ni à la base, ni au réseau, ni à l'IA : texte entrant, texte sortant.
 * Il est IDEMPOTENT (une deuxième passe ne change rien) et ne réécrit JAMAIS un attribut
 * HTML (href, src, id…) — sauf les deux liens vers les pages retirées (cf. `LIENS_RETIRES`).
 */
import { JSDOM } from "jsdom";

export type Langue = "fr" | "en";

import { PHRASE_EN, PHRASE_FR, QUESTION_EN, QUESTION_FR } from "./phrases-standard";
export { PHRASE_EN, PHRASE_FR, QUESTION_EN, QUESTION_FR };

export function phrase(langue: Langue): string {
  return langue === "en" ? PHRASE_EN : PHRASE_FR;
}
export function question(langue: Langue): string {
  return langue === "en" ? QUESTION_EN : QUESTION_FR;
}

/** Pages retirées du site : un lien vers elles est redirigé vers le catalogue. */
export const LIENS_RETIRES =
  /\/(?:fr|en)\/(?:financement-opco-france-travail|certification-qualiopi)(?=[/?#]|$)/i;

/** Toujours visés, quel que soit le contexte. */
const TOUJOURS: readonly RegExp[] = [
  /\bOPCOs?\b/i,
  /qualiopi/i,
  /datadock/i,
  /\bEDOF\b/,
  /subrogation/i,
  /mon ?compte ?formation/i,
  /FNE[- ]Formation/i,
  /\bAIF\b/,
  /finan[cç]ables?/i,
  // « Axion-IA prépare la certification qualité », « certifié qualité » : même retrait que Qualiopi.
  /certifi(?:cation|[ée]e?s?)\s+qualit[ée]/i,
];

/** Visés seulement avec un marqueur de financement dans la MÊME phrase. */
const CONDITIONNELS: readonly RegExp[] = [
  /\bCPF\b/,
  /France Travail/i,
  /P[ôo]le[- ]emploi/i,
  /compte personnel de formation/i,
  /personal training account/i,
];

const MARQUEUR =
  /financ|[ée]ligible|mobilis|rembours|co[ûu]t|plan de d[ée]veloppement des comp[ée]tences|skills development plan|france comp[ée]tences|\bfund/i;

/** « prise en charge » : visée seulement au sens financier (« prise en charge des appels » reste). */
const PRISE_EN_CHARGE = /pris(?:e|es)? en charge|covered by|taken care of by/i;
/**
 * Marqueurs d'un sens FINANCIER de « prise en charge ». Ni « coût », ni « tarif », ni « € »,
 * ni « gratuit » n'y suffisent : « La prise en charge des appels réduit le coût de 30 % » reste.
 */
const SENS_FINANCIER = new RegExp(
  [
    "financ",
    "\\bfund",
    "OPCO",
    "\\bCPF\\b",
    "France Travail",
    "P[ôo]le[- ]emploi",
    "France Comp[ée]tences",
    "formations? certifiantes?",
    "rembours",
    "reimburs",
    "subrogation",
    "subvention",
    "[ée]ligible",
    "\\beligible",
    // « La prise en charge dépend de la certification de l'organisme formateur » : sens financier.
    "certification de l'organisme",
    "modalit[ée]s? de (?:la )?prise en charge",
    "(?:dossier|demande|accord) de prise en charge",
    "pris(?:e|es)? en charge (?:totale|partielle|financi[èe]re)",
    "(?:totally|fully|partially) covered",
    "pris(?:e|es)? en charge par (?:l'|le |la |les )?(?:organisme|op[ée]rateur|r[ée]gion|[ÉEée]tat|employeur|branche|agefiph|conseil r[ée]gional)",
  ].join("|"),
  "i",
);

/** Titre qui parle de financement (pour ne retirer une section que si elle en parle). */
const TITRE_FINANCEMENT = /financ|\bfund|prise en charge|subvention|rembours/i;

// ───────────────────────────── utilitaires texte ─────────────────────────────

function normaliser(s: string): string {
  return s.replace(/[  ]/g, " ").replace(/[’‘`]/g, "'");
}

let documentPartage: Document | null = null;
function doc(): Document {
  if (!documentPartage) documentPartage = new JSDOM("<!doctype html><body></body>").window.document;
  return documentPartage;
}

const BLOCS_TEXTE = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "UL",
  "OL",
  "TD",
  "TH",
  "TR",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "DIV",
  "BLOCKQUOTE",
  "SECTION",
  "ARTICLE",
  "ASIDE",
  "HEADER",
  "FOOTER",
  "DL",
  "DT",
  "DD",
  "FIGURE",
  "FIGCAPTION",
  "DETAILS",
  "SUMMARY",
  "PRE",
  "HR",
  "BR",
  "NAV",
  "MAIN",
]);

const TAGS_NON_TEXTE: ReadonlySet<string> = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);

/** Texte d'un nœud ; chaque frontière de bloc (et chaque <br>) devient `sep`. */
function texteNoeudHtml(n: Node, sep: string): string {
  if (n.nodeType === 3) return n.nodeValue ?? "";
  if (n.nodeType !== 1) return "";
  const el = n as Element;
  // JSON-LD, styles, gabarits : jamais du texte lisible (A1, essai du 20/11).
  if (TAGS_NON_TEXTE.has(el.tagName)) return "";
  const interieur = Array.from(el.childNodes)
    .map((c) => texteNoeudHtml(c, sep))
    .join("");
  return BLOCS_TEXTE.has(el.tagName) ? `${sep}${interieur}${sep}` : interieur;
}

/**
 * Texte brut (entités décodées, balises retirées) d'un fragment HTML. Les blocs (p, titres, li,
 * td, br, div…) sont séparés par UN espace : « objectifs</p><p>Notre » → « objectifs Notre ».
 */
export function htmlVersTexte(html: string): string {
  const d = doc().createElement("div");
  d.innerHTML = html;
  return texteNoeudHtml(d, " ").replace(/\s+/g, " ").trim();
}

/** Blocs de texte d'un fragment HTML (un par paragraphe, titre, puce, cellule…). */
export function htmlVersBlocs(html: string): string[] {
  const d = doc().createElement("div");
  d.innerHTML = html;
  return texteNoeudHtml(d, "\n")
    .split(/\n+/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter((x) => x !== "");
}

/** Une phrase (texte brut) est-elle visée ? */
export function estVisee(texte: string): boolean {
  const t = normaliser(texte);
  if (TOUJOURS.some((r) => r.test(t))) return true;
  if (PRISE_EN_CHARGE.test(t) && SENS_FINANCIER.test(t)) return true;
  if (CONDITIONNELS.some((r) => r.test(t)) && MARQUEUR.test(t)) return true;
  return false;
}

const SIGLES = "(?:CPF|OPCOs?|France Travail|P[ôo]le emploi|AIF|FNE-Formation|Qualiopi|EDOF)";
const FRAGMENT_PARENTHESE = new RegExp(
  `\\s*\\(\\s*(?:${SIGLES}(?:\\s*(?:,|;|et|ou|/|and|or)\\s*)?)+\\)`,
  "gi",
);
const FRAGMENT_FINANCABLES = /,\s*finan[cç]ables?\s+(?:par|via)\s+(?:les\s+)?OPCOs?\s*,/gi;
/** Libellé « (financement) » seul (offres d'emploi, titres, descriptions) : retiré où qu'il soit. */
const LIBELLE_FINANCEMENT = /\s*\((?:financements?|funding)\)/gi;

/** Retire les fragments qui se suffisent à eux-mêmes : « (CPF, OPCO, France Travail) ». */
function retirerFragments(s: string): string {
  const r = s
    .replace(FRAGMENT_PARENTHESE, "")
    .replace(FRAGMENT_FINANCABLES, ",")
    .replace(LIBELLE_FINANCEMENT, "");
  return r === s ? s : nettoyerPonctuation(r);
}

/**
 * Ponctuation orpheline laissée par un retrait de fragment (A3) : « (UNESCO), (AFNOR), . » →
 * « (UNESCO), (AFNOR). ». N'est appelée QUE si un fragment a été retiré.
 */
function nettoyerPonctuation(s: string): string {
  return (
    s
      .replace(/\(\s*\)/g, "")
      .replace(/\(\s*[,;]\s*/g, "(")
      .replace(/\s*[,;]\s*\)/g, ")")
      .replace(/[,;](?:\s*[,;])+/g, (m) => m.trim().charAt(0))
      .replace(/[,;]\s*(?=[.!?…](?:\s|$|<))/g, "")
      // P5 : « Organismes, et partenaires » (virgule orpheline devant et/ou/and/or).
      // Q4 (documenté, accepté) : toute virgule devant et/ou/and/or du bloc est retirée, y compris une
      // virgule légitime (« les équipes RH, et les dirigeants ») : typographiquement acceptable en français.
      .replace(/\s*[,;]\s*(?=(?:et|ou|and|or)\s)/g, " ")
      .replace(/[,;]\s*(?=<\/|$)/g, "")
  );
}

/** La question d'une FAQ parle-t-elle de financement ? (gabarit d'override : A7) */
export function questionParleDeFinancement(question: string): boolean {
  return TITRE_FINANCEMENT.test(normaliser(question));
}

/**
 * Blocs de texte d'UNE section de titre `titre` (titre inclus, jusqu'au titre de même niveau ou
 * supérieur), pour n'imprimer au rapport que la section ambiguë et non l'article entier (A9).
 */
export function blocsDeSection(html: string, titre: string): string[] {
  const d = doc().createElement("div");
  d.innerHTML = html;
  const enfants = Array.from(d.children);
  const cible = titre.replace(/\s+/g, " ").trim();
  for (let i = 0; i < enfants.length; i++) {
    const h = enfants[i]!;
    const niv = niveau(h);
    if (niv < 2 || niv > 4) continue;
    if (!(h.textContent ?? "").replace(/\s+/g, " ").trim().startsWith(cible)) continue;
    return [h, ...section(enfants, i, niv)].flatMap((el) => htmlVersBlocs(el.outerHTML));
  }
  return [];
}

/** Découpe en phrases sur une chaîne HTML ou texte (la balise fermante après le point est permise). */
function phrases(s: string): string[] {
  return s
    .split(/(?<=[.!?…]|[.!?…]<\/[a-z0-9]+>)\s+(?=(?:<[^>]+>)*[A-ZÀ-ÝÉ«"“0-9])/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

// ───────────────────────────── journal des règles ciblées ─────────────────────────────

let journal: string[] | null = null;
/** Nombre de décomptes corrigés depuis le début du processus (lu par le verrou final). */
let decomptesCorriges = 0;
/** Nombres d'ORIGINE (normalisés) des décomptes corrigés, dans l'ordre (index = `decomptesCorriges`). */
const nombresOrigine: string[] = [];
function noter(regle: string): void {
  if (regle.startsWith("décompte corrigé")) {
    decomptesCorriges++;
    const m = /^décompte corrigé : « (\S+) /.exec(regle);
    nombresOrigine.push(m ? (motsDe(m[1]!)[0] ?? "") : "");
  }
  journal?.push(regle);
}
/** Exécute `f` en recueillant les règles ciblées appliquées (pour le rapport). */
export function capterRegles<T>(f: () => T): { valeur: T; regles: string[] } {
  const precedent = journal;
  const regles: string[] = [];
  journal = regles;
  try {
    return { valeur: f(), regles };
  } finally {
    journal = precedent;
  }
}

// ───────────────────────────── retrait d'un FRAGMENT ─────────────────────────────

const NOMBRES: Record<string, number> = {
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
};
const MOTS_NOMBRES = Object.keys(NOMBRES);
const DECOMPTE = new RegExp(
  `\\b(\\d{1,2}|${MOTS_NOMBRES.join("|")})\\s+((?:é|e)tapes?|points?|leviers?|piliers?|axes?|phases?|crit[èe]res?|[ée]l[ée]ments?|facteurs?|principes?|volets?|dimensions?|moyens?|actions?|domaines?|modules?|blocs?|cl[ée]s|bonnes pratiques|r[èe]gles?|conseils?|raisons?|avantages?|b[ée]n[ée]fices?|offres?|services?|formations?|prestations?|solutions?|options?|produits?|programmes?|formules?|parcours|outils?|atouts?|engagements?|missions?)\\b`,
  "gi",
);

/**
 * Nombre suivi d'un nom QUELCONQUE (jusqu'à trois mots) puis d'un « : » : « Nos 4 gammes : a, b, c, d ».
 * Complète DECOMPTE, dont la liste de noms ne peut pas être exhaustive.
 */
const DECOMPTE_LISTE = new RegExp(
  `\\b(\\d{1,2}|${MOTS_NOMBRES.join("|")})\\s+((?:[a-zà-ÿ'’-]+\\s+){0,2}[a-zà-ÿ'’-]+)(?=\\s*[:：])`,
  "gi",
);

function valeurNombre(m: string): number {
  return /^\d/.test(m) ? Number(m) : (NOMBRES[m.toLowerCase()] ?? 0);
}
function ecrireNombre(n: number, modele: string): string {
  if (/^\d/.test(modele)) return String(n);
  const mot = MOTS_NOMBRES.find((k) => NOMBRES[k] === n) ?? String(n);
  return /^[A-ZÀ-Ý]/.test(modele) ? mot.charAt(0).toUpperCase() + mot.slice(1) : mot;
}

const MOTS_PENDANTS =
  /(?:^|[\s'])(?:et|ou|de|du|des|la|le|les|à|au|aux|par|via|pour|avec|sur|en|un|une|qui|que|dont|and|or|the|of|by|with|to|for)$|\b[ldLD]'$/i;

/** Le texte obtenu après retrait d'un fragment est-il encore une phrase correcte ? */
function phraseCorrecte(resultat: string, origine: string, motsMin = 4): boolean {
  const corps = resultat.replace(/[\s.!?…:;,]+$/, "");
  if (corps.split(/\s+/).filter(Boolean).length < motsMin) return false;
  if (estVisee(resultat)) return false;
  if (/,\s*,|\(\s*\)|\s[,.]|,\s*[.!?]\s*$|\s{2,}/.test(resultat)) return false;
  // Parenthèses équilibrées : « (audit et formation. » est une coupure ratée.
  if ((resultat.match(/\(/g) ?? []).length !== (resultat.match(/\)/g) ?? []).length) return false;
  if (MOTS_PENDANTS.test(corps)) return false;
  const base = origine.replace(/[\s.!?…]+$/, "");
  return corps.length >= base.length * 0.4;
}

interface Fragment {
  texte: string;
  ambigu?: string;
}

/** Connecteur entre un nombre annoncé et son énumération : « sont », « comprend »… */
const CONNECTEUR_DECOMPTE =
  /^[^,:;.]{0,80}?\b(?:sont|est|comprennent|comprend|incluent|inclut|reposent sur|repose sur)\s+/i;

/**
 * Nombre placé APRÈS la liste : « a, b, x et c : nos 4 offres ». Corrigé si la liste (tout ce qui
 * précède le « : ») compte exactement le nombre annoncé, sinon ambigu. Aucun nombre : rien à faire.
 */
function decompteApresListe(
  corps: string,
  resultat: string,
  debutRetrait: number,
  retires: number,
): { texte: string; ambigu?: string } {
  let trouve: RegExpMatchArray | null = null;
  for (const m of corps.matchAll(DECOMPTE)) {
    const idx = m.index ?? 0;
    if (idx < debutRetrait) continue;
    if (/[:：]\s*(?:[a-zà-ÿ'’-]+\s+){0,2}$/i.test(corps.slice(0, idx))) {
      trouve = m;
      break;
    }
  }
  if (!trouve || trouve.index === undefined) return { texte: resultat };
  const pre = corps.slice(0, trouve.index).replace(/\s*[:：]\s*(?:[a-zà-ÿ'’-]+\s+){0,2}$/i, "");
  const n = valeurNombre(trouve[1]!);
  const elements = pre
    .split(/,\s+(?:et\s+|ou\s+)?|\s+(?:et|ou)\s+/)
    .filter((x) => x.trim() !== "").length;
  const pos = resultat.lastIndexOf(trouve[0]);
  if (elements !== n || n - retires < 2 || pos < 0)
    return {
      texte: resultat,
      ambigu: `décompte à vérifier : « ${trouve[0]} » placé après la liste (${elements} éléments)`,
    };
  const nouveau = ecrireNombre(n - retires, trouve[1]!);
  noter(`décompte corrigé : « ${trouve[1]} ${trouve[2]} » → « ${nouveau} ${trouve[2]} »`);
  return {
    texte:
      resultat.slice(0, pos) + `${nouveau} ${trouve[2]}` + resultat.slice(pos + trouve[0].length),
  };
}

/**
 * Corrige « sept étapes : a, b, x, c » ou « Les 3 piliers sont a, b et c » quand `retires` éléments
 * de la liste sont retirés. Un nombre annoncé devant l'énumération qui ne se vérifie pas (pas de
 * « : » ni de « sont » derrière, nombre d'éléments différent) rend la phrase ambiguë.
 */
function corrigerDecompte(
  corps: string,
  resultat: string,
  debutRetrait: number,
  retires: number,
): { texte: string; ambigu?: string } {
  const avant = corps.slice(0, debutRetrait);
  let dernier: RegExpMatchArray | null = null;
  for (const re of [DECOMPTE, DECOMPTE_LISTE])
    for (const m of avant.matchAll(re))
      if (!dernier || (m.index ?? 0) >= (dernier.index ?? 0)) dernier = m;
  if (!dernier || dernier.index === undefined)
    return decompteApresListe(corps, resultat, debutRetrait, retires);
  const suite = corps.slice(dernier.index + dernier[0].length);
  const apresDeuxPoints = /^\s*[:：]\s*/.exec(suite);
  const apresConnecteur = apresDeuxPoints ? null : CONNECTEUR_DECOMPTE.exec(suite);
  const liste = apresDeuxPoints
    ? suite.slice(apresDeuxPoints[0].length)
    : apresConnecteur
      ? suite.slice(apresConnecteur[0].length)
      : null;
  if (liste === null)
    return {
      texte: resultat,
      ambigu: `décompte à vérifier : « ${dernier[0]} » (énumération sans « : » ni « sont »)`,
    };
  const n = valeurNombre(dernier[1]!);
  const elements = liste
    .split(/,\s+(?:et\s+|ou\s+)?|\s+(?:et|ou)\s+/)
    .filter((x) => x.trim() !== "").length;
  if (elements !== n || n - retires < 2)
    return {
      texte: resultat,
      ambigu: `décompte à vérifier : « ${dernier[0]} » (${elements} éléments)`,
    };
  const nouveau = ecrireNombre(n - retires, dernier[1]!);
  noter(`décompte corrigé : « ${dernier[1]} ${dernier[2]} » → « ${nouveau} ${dernier[2]} »`);
  return {
    texte:
      resultat.slice(0, dernier.index) +
      `${nouveau} ${dernier[2]}` +
      resultat.slice(dernier.index + dernier[0].length),
  };
}

const MOT_CERTIF =
  /\s*(?:[-–—:&/|+,]\s*|\b(?:et|ou)\s+)?(?:certifi[ée]e?s?\s+|certification\s+|label\s+)?(?:Qualiopi|Datadock)\b/gi;
/** Titre : mot de financement ou de certification en FIN de libellé seulement. */
const MOT_TITRE =
  /\s*(?:[-–—:&/|+,]\s*|\b(?:et|ou)\s+)?(?:certifi[ée]e?s?\s+|certification\s+|label\s+)?(?:Qualiopi|Datadock|OPCOs?|EDOF|FNE-Formation|AIF)\s*$/i;

const HORS_FORME = (phrase: string): string =>
  `forme non prouvée (hors « A, B et X. », parenthèse, phrase entière) : « ${phrase.slice(0, 160)} »`;

/** Connecteurs : au-delà d'un seul « et/ou » avant le dernier élément, la phrase n'est plus simple. */
const CONNECTEURS =
  /\b(?:et\/ou|and\/or|ainsi que|tandis que|et|ou|puis|and|or|plus|mais|sinon|voire)\b/gi;
const MOTS_ANGLAIS =
  /\b(?:the|we|our|you|your|with|for|of|to|is|are|and|or|in|on|by|offers?|funding|training|follow-up)\b/i;

/**
 * Forme prouvée (c) : énumération FRANÇAISE « A, B, X et C », « A, X et C » ou « A, B et X » :
 * éléments séparés par des virgules, UN SEUL connecteur « et »/« ou » juste avant le dernier
 * élément, rien après le dernier élément, aucun « : » de liste ni « ; », aucune balise ni entité.
 */
function formeSimple(corps: string): boolean {
  if (/[<>&;]/.test(corps) || MOTS_ANGLAIS.test(corps)) return false;
  if ((corps.match(CONNECTEURS) ?? []).length !== 1) return false;
  const segs = corps.split(/,\s+/);
  if (segs.length < 2) return false;
  const dernier = segs[segs.length - 1]!;
  const ouvre = /^(?:et|ou)\s+\S/i.test(dernier);
  const milieu = /^\S[\s\S]*?\s(?:et|ou)\s+\S/i.test(dernier);
  if (!ouvre && !milieu) return false;
  // Rien après le dernier élément : il ne porte ni verbe (« … ou France Num existent »), ni suite longue.
  const mots = dernier.replace(/^(?:et|ou)\s+/i, "").split(/\s+/);
  const dernierMot = mots[mots.length - 1]!;
  if (/(?:ent|ont|ez|ons|ait|ent)$/i.test(dernierMot) && !/ment$/i.test(dernierMot)) return false;
  return mots.length <= 8;
}

/**
 * La phrase mêle des éléments visés et des éléments non visés (énumération, segments liés) :
 * la retirer en entier perdrait des mots non visés. Hors forme prouvée → ambiguë.
 */
function melange(brut: string): boolean {
  const segs = brut
    .replace(/[.!?…\s]+$/, "")
    .split(
      /,\s+|;\s+|\s*[:：]\s+|\s+[—–]\s+|\s*\(|\s+(?:et\/ou|and\/or|ainsi que|tandis que|et|ou|puis|and|or)\s+/i,
    )
    .map((x) => x.replace(/^[\s)]+|[\s)]+$/g, ""))
    .filter((x) => x !== "");
  if (segs.length < 2 || !segs.some((x) => estVisee(x))) return false;
  // Tout segment non visé et non financier compte, même un premier segment d'un seul mot
  // (« Audit puis financement OPCO », « Diagnostic et financement OPCO »).
  return segs.some((x) => !estVisee(x) && !MOT_FINANCEMENT.test(normaliser(x)));
}

/** Premier mot plein d'un élément d'énumération : un mot de financement (et pas un service qualifié). */
const ELEMENT_FINANCEMENT =
  /^(?:(?:le|la|les|l'|un|une|des|d'un|d'une|du|votre|vos|notre|nos|ce|cette|ces)\s*)?(?:financ|pris(?:e|es) en charge|opcos?\b|cpf\b|france travail|subvention|rembours|aides? (?:financi[eè]res?|opcos?\b|cpf\b))/i;
function elementDeFinancement(segment: string): boolean {
  return ELEMENT_FINANCEMENT.test(normaliser(segment).trim());
}

/**
 * Retire le FRAGMENT visé d'une phrase, pas la phrase : parenthèse, élément d'énumération entre
 * virgules (avec correction du décompte « sept étapes »), fin de phrase après « et », mot de
 * certification isolé. `null` : aucune coupure propre. `ambigu` : coupure possible mais le
 * décompte annoncé ne se vérifie pas.
 */
function fragmenter(phrase: string): Fragment | null {
  const m = /^([\s\S]*?)([.!?…]*)\s*$/.exec(phrase);
  const corps0 = m?.[1] ?? phrase;
  const fin = m?.[2] ?? "";
  const ok = (c: string): boolean => phraseCorrecte(c + fin, phrase);

  // 1. Parenthèse visée.
  // Retirée seulement si son contenu COMMENCE par un mot de financement et ne mêle aucun segment
  // non visé : « (audit, formation et financement OPCO) » contient de vrais services → ambigu.
  const sansParenthese = corps0.replace(/\s*\(([^()]*)\)/g, (tout, dedans: string) =>
    estVisee(dedans) && elementDeFinancement(dedans) && !melange(dedans) ? "" : tout,
  );
  if (sansParenthese !== corps0 && ok(sansParenthese)) {
    noter("fragment entre parenthèses retiré");
    return { texte: sansParenthese + fin };
  }
  const base = sansParenthese !== corps0 ? sansParenthese : corps0;

  // 2. Segments entre virgules (jamais le premier : il porte le sujet). Le dernier élément
  // « x et y » est éclaté pour que « et la formation » ne parte pas avec l'élément visé.
  const segments = base.split(/,\s+/);
  let conjonction: string | null = null;
  // TOUJOURS éclaté quand l'énumération compte au moins deux virgules : sinon le dernier segment
  // « x et y » partirait en bloc avec un élément sans rapport. Sans nombre ni « : », seuls les
  // éléments visés guident la coupe (le rendu est contrôlé par phraseCorrecte).
  // Exception : un dernier segment qui porte un verbe (« x ou y peuvent être mobilisés ») est un
  // prédicat, pas un élément de liste : ancien comportement (hors nombre annoncé ou « : »).
  const annoncee = new RegExp(DECOMPTE.source, "i").test(base) || /[:：]/.test(segments[0]!);
  const predicat =
    !annoncee &&
    /\b(?:peu(?:t|vent)|sont|est|[êe]tre|permet(?:tent)?|sera|seront|ont|sera|devr(?:a|ont)|doivent|doit|d[ée]pend(?:ent)?)\b/i.test(
      segments[segments.length - 1]!,
    );
  const simple = formeSimple(base) && !predicat;
  if (simple && segments.length > 1) {
    const dernierSeg = segments.pop()!;
    const tete = /^(et|ou)\s+([\s\S]+)$/i.exec(dernierSeg);
    const milieu = tete ? null : /^([\s\S]+?)\s+(et|ou)\s+([\s\S]+)$/i.exec(dernierSeg);
    if (tete) {
      conjonction = tete[1]!;
      segments.push(tete[2]!);
    } else if (milieu) {
      conjonction = milieu[2]!;
      segments.push(milieu[1]!, milieu[3]!);
    } else segments.push(dernierSeg);
  }
  if (simple && segments.length > 2 && !estVisee(segments[0]!)) {
    const visees = segments.map((s) => estVisee(s));
    if (visees.filter(Boolean).length === 1) {
      // Forme prouvée : l'élément n'est retiré en entier que si son PREMIER mot plein est un mot de
      // financement. « formation éligible au CPF » est un vrai service qualifié : ambigu.
      if (!segments.some((s, i) => visees[i] && elementDeFinancement(s)))
        return { texte: phrase, ambigu: HORS_FORME(phrase) };
      const gardes = segments.filter((_, i) => !visees[i]);
      const retires = segments.length - gardes.length;
      const premierRetire = visees.indexOf(true);
      let sortie = "";
      if (conjonction && gardes.length >= 2)
        sortie = `${gardes.slice(0, -1).join(", ")} ${conjonction} ${gardes[gardes.length - 1]}`;
      else if (conjonction) sortie = gardes.join(", ");
      else
        segments.forEach((s, i) => {
          if (visees[i]) return;
          if (sortie === "") sortie = s;
          else if (visees[i - 1] && /^(?:et|ou)\s/i.test(s)) sortie += ` ${s}`;
          else sortie += `, ${s}`;
        });
      if (ok(sortie)) {
        const debut = segments.slice(0, premierRetire).join(", ").length;
        const c = corrigerDecompte(base, sortie, debut, retires);
        if (c.ambigu) return { texte: phrase, ambigu: c.ambigu };
        noter(`fragment retiré : ${retires} élément(s) d'énumération`);
        return { texte: c.texte + fin };
      }
    }
  }

  // 3. Fin de phrase après « et » / « ou ».
  const re = /\s+(?:et|ou|and|or)\s+/gi;
  const coupures = [...base.matchAll(re)].reverse();
  for (const c of coupures) {
    const tete = base.slice(0, c.index);
    const queue = base.slice((c.index ?? 0) + c[0].length);
    if (estVisee(queue) && !estVisee(tete) && ok(tete))
      return { texte: phrase, ambigu: HORS_FORME(phrase) };
  }

  // 4. Mot de certification isolé (« audits Qualiopi » → « audits »).
  const sansMot = base.replace(MOT_CERTIF, "");
  if (sansMot !== base && ok(sansMot)) return { texte: phrase, ambigu: HORS_FORME(phrase) };
  return null;
}

/** La phrase est-elle consacrée au financement (le sujet est dans ses premiers mots) ? */
const MOT_FINANCEMENT =
  /financ|\bfund(?:s|ing|ed|able)?\b|pris(?:e|es)? en charge|OPCO|\bCPF\b|France Travail|P[ôo]le[- ]emploi|qualiopi|[ée]ligible|rembours|subvention|\bAIF\b|datadock|\bEDOF\b|subrogation|mon ?compte ?formation|FNE/i;

/**
 * Sujet de la phrase : son PREMIER MOT PLEIN (après un déterminant ou un possessif) est un mot de
 * financement. Un sigle qui qualifie un autre sujet (« Formation OPCO… », « Atelier financé par
 * l'OPCO ») ou suit un vrai service (« Audit puis financement OPCO ») ne rend PAS la phrase pure.
 */
const SUJET_FINANCEMENT =
  /^(?:financ|fund(?:s|ing|ed|able)?\b|pris(?:e|es) en charge|opcos?\b|cpf\b|france travail|p[ôo]le[- ]emploi|subvention|rembours|aif\b|edof\b|subrogation|mon ?compte ?formation|fne\b)/i;
const DETERMINANT_DEBUT =
  /^(?:(?:le|la|les|un|une|des|du|de|votre|vos|notre|nos|ce|cette|ces|son|sa|ses|leur|leurs|the|a|an|your|our|this|these|its|their)\s+|(?:l|d)'\s*)/i;

function estPur(texte: string, html = ""): boolean {
  // Balise en ligne : « pur » seulement si la phrase visée est entière (aucun élément non visé).
  if (/<[a-z][^>]*>/i.test(html) && melange(texte)) return false;
  let debut = normaliser(texte)
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "");
  for (let i = 0; i < 4 && DETERMINANT_DEBUT.test(debut); i++)
    debut = debut.replace(DETERMINANT_DEBUT, "");
  // Phrase faite UNIQUEMENT de mots du lexique fermé (« Dossier AIF ») : rien de non financier à perdre.
  // (les phrases portant un mot de SENS_PROPRE n'y sont admises que si elles sont visées, non mêlées)
  return (
    SUJET_FINANCEMENT.test(debut) ||
    (motsNonRetirables(texte, "").length === 0 &&
      (!motsDe(texte).some((m) => SENS_PROPRE.has(m)) || (estVisee(texte) && !melange(texte))))
  );
}

/**
 * A4 (essai du 20/11) : la détection se fait sur la phrase d'ORIGINE. Quand le retrait d'un fragment
 * (« (AIF) ») fait tomber le seul marqueur d'une phrase visée, un motif conditionnel (CPF, France
 * Travail, Pôle emploi…) peut rester publié sans plus être vu. Rend les phrases concernées : elles
 * deviennent AMBIGUËS (jamais « propres »).
 */
function conditionnelsRestants(origine: string, estHtml: boolean): string[] {
  const out: string[] = [];
  for (const p of phrases(origine)) {
    const avant = estHtml ? htmlVersTexte(p) : p;
    if (!estVisee(avant)) continue;
    const sans = retirerFragments(p);
    if (sans === p) continue;
    const apres = estHtml ? htmlVersTexte(sans) : sans;
    if (CONDITIONNELS.some((r) => r.test(normaliser(apres))))
      out.push(
        `mention restante après retrait d'un fragment (France Travail, CPF…) : « ${avant.slice(0, 160)} »`,
      );
  }
  return out;
}

interface SortiePhrase {
  type: "garde" | "modifie" | "retire" | "ambigu";
  texte: string;
  pur?: boolean;
  ambigu?: string;
  /** `texte` est du HTML à remettre tel quel (puce dont un fragment a été retiré). */
  html?: boolean;
}

/**
 * Une phrase : gardée, fragment retiré, retirée en entier (`court: false`, corps d'article) ou
 * ambiguë (`court: true`, champ court : une phrase mixte sans coupure propre n'est jamais retirée).
 */
function traiterPhrase(p: string, estHtml: boolean, court: boolean): SortiePhrase {
  const brut = estHtml ? htmlVersTexte(p) : p;
  if (!estVisee(brut)) return { type: "garde", texte: p };
  if (!p.includes("<") && !p.includes("&")) {
    const f = fragmenter(p);
    if (f?.ambigu) return { type: "ambigu", texte: p, ambigu: f.ambigu };
    if (f) return { type: "modifie", texte: f.texte };
  }
  if (melange(brut)) return { type: "ambigu", texte: p, ambigu: HORS_FORME(brut) };
  const pur = estPur(brut, p);
  if (court && !pur)
    return {
      type: "ambigu",
      texte: p,
      ambigu: `phrase mixte sans coupure propre : « ${brut.slice(0, 160)} »`,
    };
  return { type: "retire", texte: "", pur };
}

/**
 * Une puce (HTML ou JSON : même règle). La puce entière est analysée, balises en ligne comprises :
 * retirée seulement si elle est pure et sans autre phrase ; sinon ambiguë (jamais de perte muette).
 */
function verdictPuce(contenu0: string, estHtml: boolean): SortiePhrase {
  // Même prétraitement qu'un paragraphe (`traiterBloc`) : « (OPCO) » seul part proprement, de sorte
  // que « Ateliers (OPCO) sur ChatGPT. » a le même verdict en puce et en paragraphe.
  const residuels = conditionnelsRestants(contenu0, estHtml);
  if (residuels[0] !== undefined) return { type: "ambigu", texte: contenu0, ambigu: residuels[0] };
  const contenu = retirerFragments(contenu0);
  const s0 = traiterPhrase(contenu, estHtml, true);
  if (s0.type === "garde" && contenu !== contenu0)
    return { type: "modifie", texte: contenu.replace(/\s{2,}/g, " ").trim(), html: estHtml };
  const s = s0;
  if (s.type !== "retire") return s;
  const ps = phrases(contenu).map((p) => traiterPhrase(p, estHtml, true));
  if (ps.some((x) => x.type === "garde"))
    return {
      type: "ambigu",
      texte: contenu,
      ambigu: `puce mixte (phrase visée et phrase non visée) : « ${(estHtml ? htmlVersTexte(contenu) : contenu).slice(0, 160)} »`,
    };
  return s;
}

interface Bloc {
  /** Contenu (HTML ou texte) après réécriture. */
  contenu: string;
  modifie: boolean;
  /** Au moins une phrase visée avant réécriture. */
  visee: boolean;
  /** Vide après réécriture : l'élément doit être retiré. */
  vide: boolean;
  ambigus: string[];
}

/**
 * Règle d'un paragraphe (ou d'un champ long) : on retire le FRAGMENT visé, sinon la PHRASE visée.
 * La phrase standard ne remplace le paragraphe que si TOUTES ses phrases sont consacrées au
 * financement : un paragraphe qui parle d'autre chose n'est jamais remplacé en entier.
 */
function traiterBloc(contenu: string, langue: Langue, estHtml: boolean): Bloc {
  const residuels = conditionnelsRestants(contenu, estHtml);
  if (residuels.length > 0)
    return { contenu, modifie: false, visee: true, vide: false, ambigus: residuels };
  const sansFragments = retirerFragments(contenu);
  const liste = phrases(sansFragments);
  // `court: true` aussi dans un corps : une phrase visée dont le sujet n'est pas le financement n'est
  // jamais retirée en entier (voisines ou non) ; ambiguë. Seule une phrase PURE part.
  const sorties = liste.map((p) => traiterPhrase(p, estHtml, true));
  const visees = sorties.filter((x) => x.type !== "garde").length;
  if (visees === 0) {
    const modifie = sansFragments !== contenu;
    return {
      contenu: modifie ? sansFragments.replace(/\s{2,}/g, " ").trim() : contenu,
      modifie,
      visee: false,
      vide: false,
      ambigus: [],
    };
  }
  const ambigus = sorties.flatMap((x) => (x.ambigu ? [x.ambigu] : []));
  if (ambigus.length > 0) return { contenu, modifie: false, visee: true, vide: false, ambigus };
  if (sorties.every((x) => x.type === "retire")) {
    if (sorties.some((x) => x.pur))
      return { contenu: phrase(langue), modifie: true, visee: true, vide: false, ambigus: [] };
    return {
      contenu,
      modifie: false,
      visee: true,
      vide: false,
      ambigus: [
        `paragraphe visé sans coupure propre : « ${htmlVersTexte(contenu).slice(0, 160)} »`,
      ],
    };
  }
  const resultat = sorties
    .filter((x) => x.type !== "retire")
    .map((x) => x.texte)
    .join(" ");
  return {
    contenu: resultat,
    modifie: true,
    visee: true,
    vide: resultat.trim() === "",
    ambigus: [],
  };
}

// ───────────────────────────── VERROU FINAL ─────────────────────────────
//
// Garantie unique, appliquée à TOUTE réécriture automatique (texte, `<p>`, `<li>`, Tiptap, FAQ,
// avantages, blocs structurels) : on calcule les mots RETIRÉS (multiensemble des mots de l'origine
// moins ceux du résultat, casse/accents normalisés, HTML enlevé). Si UN SEUL mot retiré n'est pas
// dans le lexique fermé `LEXIQUE_RETIRABLE`, la réécriture est ANNULÉE : la valeur d'origine est
// gardée et le cas devient AMBIGU (à trancher par un humain). Les règles de forme (A1-B) restent des
// améliorations ; c'est ce verrou qui garantit qu'aucun mot non financier ne disparaît en silence.
// Seule exception : le nombre d'un décompte corrigé (« sept étapes » → « six étapes »), déjà prouvé.

export function motsDe(texte: string): string[] {
  return normaliser(texte)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((x) => x !== "");
}

/** Mots-outils : articles, prépositions, conjonctions, pronoms, auxiliaires être/avoir/pouvoir. */
const MOTS_OUTILS = new Set(
  // articles, déterminants, possessifs
  (
    "le la les l un une des du de d au aux ce cet cette ces c son sa ses leur leurs votre vos notre nos mon ma mes ton ta tes " +
    // prépositions, conjonctions, adverbes de liaison, élisions
    "a en et ou ni mais or donc car puis que qu qui dont par pour sur sous avec sans dans chez entre vers selon comme si via ainsi " +
    "tandis voire alors lorsque quand aussi s n j m t y " +
    // pronoms
    "je tu il elle on nous vous ils elles me te se lui en y ne pas " +
    // être
    "etre suis es est sommes etes sont etais etait etions etiez etaient fus fut serai seras sera serons serez seront " +
    "serais serait seraient soit soient sois soyez soyons ete etant " +
    // avoir
    "avoir ai as ont avons avez avais avait avaient aurai auras aura aurons aurez auront aurait auraient ait aient eu ayant ayez " +
    // pouvoir
    "pouvoir peux peut pouvons pouvez peuvent pouvais pouvait pouviez pouvaient pourrai pourras pourra pourrons pourrez " +
    "pourront pourrait pourraient puisse puissent puissiez pu " +
    // anglais : articles, prépositions, pronoms, auxiliaires
    "the an of by with to for and in on at as from if this that these those its their your our you we it they " +
    "through per also but which who " +
    "be is are was were been being am have has had can could may might will would"
  ).split(/\s+/),
);

/** Mots de financement (stems) : financ*, rembours*, subvention*, éligib*, fund*… dressés depuis les règles. */
const RACINES_FINANCEMENT =
  /^(?:(?:financ|rembours|reimburs|subvention|eligib|opco|qualiopi|datadock|subrogation|mobilis)|fund(?:s|ing|ed|able)?$)/;

/** Mots de financement (exacts), y compris les qualificatifs d'un financement (« possible »). */
const MOTS_FINANCEMENT_EXACTS = new Set(
  (
    "cpf edof aif fne aide aides dispositif dispositifs organisme organismes fonds cout couts " +
    "certification certifie certifiee certifies certifiees qualite " +
    "possible possibles disponible disponibles accessible accessibles envisageable envisageables " +
    "available totale totales partielle partielles totalement partiellement integral integrale oui non yes no " +
    "dossier dossiers"
  ).split(/\s+/),
);

/** Locutions de financement : leurs mots sont retirables ensemble (jamais isolément). */
const LOCUTIONS_FINANCEMENT: readonly string[] = [
  "france travail",
  "pole emploi",
  "france competences",
  "prise en charge",
  "prises en charge",
  "pris en charge",
  "prise charge",
  "mon compte formation",
  "compte personnel de formation",
  "personal training account",
  "plan de developpement des competences",
  "skills development plan",
  "fonds d assurance formation",
  "fonds assurance formation",
  "fne formation",
  "certification qualite",
  "certifie qualite",
  "taken care of",
  "covered by",
];

/** Mots des phrases standard de remplacement (la réécriture peut retirer une phrase standard). */
const MOTS_PHRASES_STANDARD = [PHRASE_FR, PHRASE_EN, QUESTION_FR, QUESTION_EN].flatMap(motsDe);

/**
 * LEXIQUE FERMÉ : seuls ces mots peuvent disparaître dans une réécriture automatique =
 * mots de financement (racines, exacts, locutions) ∪ mots-outils ∪ mots des phrases standard.
 */
export const LEXIQUE_RETIRABLE = {
  outils: MOTS_OUTILS,
  racines: RACINES_FINANCEMENT,
  exacts: MOTS_FINANCEMENT_EXACTS,
  locutions: LOCUTIONS_FINANCEMENT,
  phrasesStandard: new Set(MOTS_PHRASES_STANDARD),
};

function motRetirable(m: string): boolean {
  return (
    MOTS_OUTILS.has(m) ||
    MOTS_FINANCEMENT_EXACTS.has(m) ||
    RACINES_FINANCEMENT.test(m) ||
    LEXIQUE_RETIRABLE.phrasesStandard.has(m)
  );
}

function estNombre(m: string): boolean {
  return /^\d+$/.test(m) || m in NOMBRES;
}

/**
 * Mots du lexique qui portent un sens à eux seuls (qualité, certification, accessibilité…) : une
 * phrase faite uniquement de mots du lexique qui en contient un n'est « pure » que si elle est
 * visée et non mêlée (audit passe 8, point 1). Le lexique lui-même reste inchangé.
 */
const SENS_PROPRE = new Set(
  (
    "qualite certification certifie certifiee certifies certifiees accessible accessibles " +
    "disponible disponibles dossier dossiers cout couts dispositif dispositifs organisme organismes"
  ).split(" "),
);

/**
 * Phrase « pure » pour le remplacement d'un BLOC (section, FAQ, ligne, liste) : visée ET pure (A1),
 * ou entièrement faite de mots du lexique fermé (« Oui. », « Via votre OPCO. »).
 */
function phrasePure(p: string): boolean {
  return (
    (estVisee(p) && estPur(p) && !melange(p)) ||
    (motsNonRetirables(p, "").length === 0 &&
      (!motsDe(p).some((m) => SENS_PROPRE.has(m)) || (estVisee(p) && !melange(p))))
  );
}
/** Toutes les phrases du texte sont pures : le bloc peut être remplacé sans perdre d'autre sujet. */
function textePur(texte: string): boolean {
  return phrases(texte).every(phrasePure);
}

/**
 * Mots retirés (multiensemble origine − résultat), dans l'ordre de l'origine. `injectes` : mots
 * ajoutés par la réécriture elle-même (lien, phrase standard), ôtés du résultat avant comparaison
 * pour qu'ils ne masquent pas un mot perdu ailleurs.
 */
export function motsRetires(origine: string, resultat: string, injectes: string[] = []): string[] {
  const reste = new Map<string, number>();
  for (const m of motsDe(resultat)) reste.set(m, (reste.get(m) ?? 0) + 1);
  for (const m of injectes) {
    const n = reste.get(m) ?? 0;
    if (n > 0) reste.set(m, n - 1);
  }
  const perdus: string[] = [];
  for (const m of motsDe(origine)) {
    const n = reste.get(m) ?? 0;
    if (n > 0) reste.set(m, n - 1);
    else perdus.push(m);
  }
  return perdus;
}

/**
 * Mots retirés qui n'appartiennent PAS au lexique fermé (liste vide = réécriture permise).
 * `nombresCorriges` : nombres d'ORIGINE des décomptes corrigés (normalisés), exemptés à raison d'une
 * occurrence chacun (`true` : tout nombre, forme historique des tests). `injectes` : mots injectés.
 */
export function motsNonRetirables(
  origine: string,
  resultat: string,
  nombresCorriges: boolean | string[] = false,
  injectes: string[] = [],
): string[] {
  const perdus = new Map<string, number>();
  for (const m of motsRetires(origine, resultat, injectes)) perdus.set(m, (perdus.get(m) ?? 0) + 1);
  if (Array.isArray(nombresCorriges))
    for (const n of nombresCorriges) {
      const k = perdus.get(n) ?? 0;
      if (k > 0) perdus.set(n, k - 1);
    }
  // Locutions : consommées (une occurrence de l'origine à la fois) quand tous leurs mots sont perdus.
  const tokens = motsDe(origine);
  for (const loc of LOCUTIONS_FINANCEMENT) {
    const lm = loc.split(" ");
    for (let i = 0; i + lm.length <= tokens.length; i++) {
      if (!lm.every((w, k) => tokens[i + k] === w)) continue;
      const besoin = new Map<string, number>();
      for (const w of lm) besoin.set(w, (besoin.get(w) ?? 0) + 1);
      if ([...besoin].every(([w, n]) => (perdus.get(w) ?? 0) >= n))
        for (const [w, n] of besoin) perdus.set(w, (perdus.get(w) ?? 0) - n);
    }
  }
  const hors: string[] = [];
  for (const [m, n] of perdus) {
    if (n <= 0 || motRetirable(m) || (nombresCorriges === true && estNombre(m))) continue;
    for (let k = 0; k < n; k++) hors.push(m);
  }
  return hors;
}

/** Mots des textes injectés (lien, phrase standard, question) ajoutés par la réécriture. */
function motsInjectes(avant: string, apres: string): string[] {
  const occ = (t: string, s: string) => t.split(s).length - 1;
  const mots: string[] = [];
  for (const s of [
    PHRASE_FR,
    PHRASE_EN,
    QUESTION_FR,
    QUESTION_EN,
    texteLienRemplace("fr"),
    texteLienRemplace("en"),
  ])
    for (let i = occ(apres, s) - occ(avant, s); i > 0; i--) mots.push(...motsDe(s));
  return mots;
}

/**
 * Verrou : si la réécriture `r` (valeur `avant` → `apres`) retire un mot hors lexique, elle est
 * annulée : valeur d'origine, `modifie: false`, cas AMBIGU.
 */
function verrouiller<T>(
  r: Resultat<T>,
  valeurOrigine: T,
  avant: string,
  apres: () => string,
  compteurAvant: number,
): Resultat<T> {
  if (!r.modifie) return r;
  const resultat = apres();
  const hors = motsNonRetirables(
    avant,
    resultat,
    nombresOrigine.slice(compteurAvant),
    motsInjectes(avant, resultat),
  );
  if (hors.length === 0) return r;
  return {
    valeur: valeurOrigine,
    modifie: false,
    ambigus: [
      ...r.ambigus,
      `verrou : réécriture annulée, mots non financiers retirés (${[...new Set(hors)].slice(0, 8).join(", ")}) : « ${avant.slice(0, 120)} »`,
    ],
  };
}

// ───────────────────────────── résultats ─────────────────────────────

export interface Resultat<T = string> {
  valeur: T;
  modifie: boolean;
  /** Cas à trancher par un humain (la valeur d'origine est conservée pour ces cas). */
  ambigus: string[];
}

/** Retire « (financement) » en fin de libellé : arbitrage 2 (offres d'emploi). */
function sansSuffixeFinancement(s: string): string {
  return s.replace(/\s*\((?:financements?|funding)\)\s*$/i, "");
}

/**
 * Champ court (extrait, méta, réponse directe, résumé, texte alternatif…) : retrait des phrases
 * visées. Champ qui devient vide → ambigu (valeur gardée). `titre: true` : un titre visé n'est
 * jamais réécrit seul → ambigu.
 */
export function reecrireTexte(
  texte: string,
  langue: Langue,
  options: { titre?: boolean } = {},
): Resultat {
  const c = decomptesCorriges;
  const r = reecrireTexteInterne(texte, langue, options);
  return verrouiller(r, texte, texte, () => r.valeur, c);
}

function reecrireTexteInterne(
  texte: string,
  langue: Langue,
  options: { titre?: boolean } = {},
): Resultat {
  const origine = texte;
  let courant = options.titre ? sansSuffixeFinancement(texte) : texte;
  const residuels = conditionnelsRestants(courant, false);
  if (residuels.length > 0) return { valeur: origine, modifie: false, ambigus: residuels };
  courant = retirerFragments(courant);
  if (options.titre && estVisee(courant)) {
    // Titre : seul un mot de certification en fin de libellé peut être retiré ; sinon ambigu.
    const sansMot = courant
      .replace(MOT_TITRE, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (sansMot !== courant && phraseCorrecte(sansMot, courant, 2)) {
      noter("mot de certification retiré du titre");
      return { valeur: sansMot, modifie: true, ambigus: [] };
    }
    return { valeur: origine, modifie: false, ambigus: [`titre à reformuler : « ${origine} »`] };
  }
  const liste = phrases(courant);
  const sorties = liste.map((p) => traiterPhrase(p, false, true));
  if (sorties.every((x) => x.type === "garde")) {
    const modifie = courant !== origine;
    return {
      valeur: modifie ? courant.replace(/\s{2,}/g, " ").trim() : origine,
      modifie,
      ambigus: [],
    };
  }
  const ambigus = sorties.flatMap((x) => (x.ambigu ? [x.ambigu] : []));
  if (ambigus.length > 0) return { valeur: origine, modifie: false, ambigus };
  const gardees = sorties
    .filter((x) => x.type !== "retire")
    .map((x) => x.texte)
    .join(" ")
    .trim();
  if (gardees === "") {
    return {
      valeur: origine,
      modifie: false,
      ambigus: [`champ entièrement visé : « ${origine.slice(0, 120)} »`],
    };
  }
  return { valeur: gardees, modifie: true, ambigus: [] };
}

export interface Faq {
  question: string;
  reponse: string;
}

/**
 * Organisme de financement cité dans une QUESTION (« reconnu par France Compétences ? ») : le
 * complément est retiré, la question reste (« est-il reconnu ? »).
 */
const COMPLEMENT_ORGANISME =
  /\s+(?:par|via|auprès (?:de|des|d')|grâce (?:à|aux?))\s*(?:l'|le |la |les )?(?:France Comp[ée]tences|OPCOs?|CPF|France Travail|P[ôo]le[- ]emploi)(?=\s*\?|\s*$)/i;

function nettoyerQuestion(q: string): string {
  const sans = q.replace(COMPLEMENT_ORGANISME, "");
  if (sans === q) return q;
  noter(`question reformulée sans organisme de financement : « ${q} » → « ${sans} »`);
  return sans;
}

/** Question/réponse : visée → « Comment se passe le financement ? » + phrase standard. */
export function reecrireFaq(
  f: Faq,
  langue: Langue,
): Resultat<Faq> & {
  /** Sous-ensemble de `ambigus` qui porte sur la RÉPONSE. */ ambigusReponse: string[];
} {
  const c = decomptesCorriges;
  const r = reecrireFaqInterne(f, langue);
  const v = verrouiller(
    r,
    f,
    `${f.question} ${htmlVersTexte(f.reponse)}`,
    () => `${r.valeur.question} ${htmlVersTexte(r.valeur.reponse)}`,
    c,
  );
  if (v === r) return r;
  const ajoute = v.ambigus.filter((a) => !r.ambigus.includes(a));
  return { ...v, ambigusReponse: [...r.ambigusReponse, ...ajoute] };
}

function reecrireFaqInterne(f: Faq, langue: Langue): Resultat<Faq> & { ambigusReponse: string[] } {
  const qVisee = estVisee(f.question);
  const rVisee = estVisee(htmlVersTexte(f.reponse));
  if (!qVisee && !rVisee) {
    const q = reecrireTexte(nettoyerQuestion(f.question), langue);
    const r = reecrireBloc(f.reponse, langue);
    return {
      valeur: { question: q.valeur, reponse: r.valeur },
      modifie: q.modifie || r.modifie || q.valeur !== f.question,
      ambigus: [...q.ambigus, ...r.ambigus],
      ambigusReponse: r.ambigus,
    };
  }
  const parleDeFinancement = TITRE_FINANCEMENT.test(normaliser(f.question));
  if (qVisee || parleDeFinancement) {
    // Remplacement de toute la FAQ : seulement si TOUTES les phrases de la réponse sont pures.
    if (!textePur(htmlVersTexte(f.reponse))) {
      const a = [
        `FAQ à relire (question de financement, réponse mêlée à un autre sujet) : « ${f.question.slice(0, 120)} »`,
      ];
      return { valeur: f, modifie: false, ambigus: a, ambigusReponse: a };
    }
    return {
      valeur: { question: question(langue), reponse: phrase(langue) },
      modifie: true,
      ambigus: [],
      ambigusReponse: [],
    };
  }
  // Question sans rapport, réponse visée : réécriture de la réponse seule, sinon ambigu.
  const questionPropre = nettoyerQuestion(f.question);
  const r = reecrireBloc(f.reponse, langue);
  if (r.ambigus.length > 0 || r.valeur.trim() === "" || r.valeur === phrase(langue)) {
    // C'est la RÉPONSE qui est visée : l'ambigu se tranche sur elle, pas sur la question.
    const ambigus = [
      ...r.ambigus,
      `FAQ à relire (question étrangère au financement) : « ${f.question} »`,
    ];
    return { valeur: f, modifie: false, ambigus, ambigusReponse: ambigus };
  }
  return {
    valeur: { question: questionPropre, reponse: r.valeur },
    modifie: r.modifie || questionPropre !== f.question,
    ambigus: r.ambigus,
    ambigusReponse: r.ambigus,
  };
}

/** Réponse de FAQ (fragment HTML ou texte) : règle de paragraphe, sans structure de document. */
function reecrireBloc(contenu: string, langue: Langue): Resultat {
  const estHtml = /<[a-z][\s\S]*>/i.test(contenu);
  if (!estHtml) {
    const c = decomptesCorriges;
    const b = traiterBloc(contenu, langue, false);
    const r: Resultat = {
      valeur: b.vide ? contenu : b.contenu,
      modifie: b.vide ? false : b.modifie,
      ambigus: b.vide ? ["bloc vide après retrait"] : b.ambigus,
    };
    return verrouiller(r, contenu, contenu, () => r.valeur, c);
  }
  return reecrireHtml(contenu, langue);
}

// ───────────────────────────── HTML ─────────────────────────────

const BLOCS_STRUCTURE =
  "p, ul, ol, li, table, div, blockquote, h1, h2, h3, h4, h5, h6, dl, details";
const NIVEAU = /^H([1-6])$/;

function niveau(el: Element): number {
  const m = NIVEAU.exec(el.tagName);
  return m ? Number(m[1]) : 0;
}

function creerP(d: Document, langue: Langue): HTMLElement {
  const p = d.createElement("p");
  p.textContent = phrase(langue);
  return p;
}

function estPhraseStandard(el: Element | null): boolean {
  if (!el || el.tagName !== "P") return false;
  const t = (el.textContent ?? "").trim();
  return t === PHRASE_FR || t === PHRASE_EN;
}

/** Faut-il remplacer le TEXTE d'un lien vers une page retirée ? (HTML et JSON : même règle.) */
function texteLienARemplacer(texte: string): boolean {
  return estVisee(texte) || MARQUEUR.test(texte) || TOUJOURS.some((r) => r.test(texte));
}

function hrefReecrit(href: string): string {
  return /\/en\//i.test(href) ? "/en/formations" : "/fr/formations";
}

function texteLienRemplace(langue: Langue): string {
  return langue === "en" ? "our training courses" : "nos formations";
}

/**
 * Ligne de tableau consacrée au financement (HTML et JSON : même règle). `"retirer"` : première
 * colonne visée, ou libellé de financement avec une autre cellule visée ; `"ambigu"` : cellule
 * visée hors première colonne ; `"garder"` sinon.
 */
function verdictLigne(premiere: string, autres: string[]): "retirer" | "ambigu" | "garder" {
  const p = premiere.trim();
  if (estVisee(p) || (TITRE_FINANCEMENT.test(normaliser(p)) && autres.some((c) => estVisee(c))))
    return "retirer";
  return autres.some((c) => estVisee(c)) ? "ambigu" : "garder";
}

function reecrireLiens(racine: Element, langue: Langue): boolean {
  let modifie = false;
  for (const a of Array.from(racine.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (!LIENS_RETIRES.test(href)) continue;
    // Seuls ces deux liens sont réécrits ; la langue du lien d'origine est conservée.
    a.setAttribute("href", hrefReecrit(href));
    if (texteLienARemplacer(a.textContent ?? "")) a.textContent = texteLienRemplace(langue);
    modifie = true;
  }
  return modifie;
}

/** Section d'un titre : éléments suivants jusqu'au prochain titre de niveau ≤ `niv`. */
function section(enfants: Element[], i: number, niv: number): Element[] {
  const corps: Element[] = [];
  for (let j = i + 1; j < enfants.length; j++) {
    const n = niveau(enfants[j]!);
    if (n > 0 && n <= niv) break;
    corps.push(enfants[j]!);
  }
  return corps;
}

function sectionVisee(corps: Element[]): boolean {
  return corps.some(
    (el) =>
      phrases(htmlVersTexte(el.outerHTML)).some((p) => estVisee(p)) ||
      estVisee(htmlVersTexte(el.outerHTML)),
  );
}

/** Titres H2-H4 : questions et sections consacrées au financement. */
function traiterTitres(racine: Element, d: Document, langue: Langue, ambigus: string[]): boolean {
  let modifie = false;
  // Parcours récursif : les titres imbriqués dans section / div / article sont traités comme ceux
  // de la racine (chaque conteneur qui porte au moins un titre est traité).
  const conteneurs = [
    racine,
    ...Array.from(racine.querySelectorAll("*")).filter((e) =>
      Array.from(e.children).some((c) => niveau(c) > 0),
    ),
  ];
  for (const conteneur of conteneurs) {
    if (!conteneur.isConnected) continue;
    modifie = traiterTitresDe(conteneur, d, langue, ambigus) || modifie;
  }
  return modifie;
}

function traiterTitresDe(racine: Element, d: Document, langue: Langue, ambigus: string[]): boolean {
  let modifie = false;
  const enfants = Array.from(racine.children);
  for (let i = 0; i < enfants.length; i++) {
    const h = enfants[i]!;
    const niv = niveau(h);
    if (niv < 2 || niv > 4) continue;
    if (!h.isConnected) continue;
    const titre = (h.textContent ?? "").replace(/\s+/g, " ").trim();
    const corps = section(enfants, i, niv);
    const titreVise = estVisee(titre);
    const finance = TITRE_FINANCEMENT.test(normaliser(titre));
    const concerne = titreVise || (finance && sectionVisee(corps));
    if (!concerne) continue;
    // Bloc remplacé seulement si TOUTES ses phrases sont visées et pures ; sinon ambigu.
    if (!corps.every((el) => textePur(htmlVersTexte(el.outerHTML)))) {
      ambigus.push(
        `section « ${titre.slice(0, 100)} » : financement mêlé à un autre sujet, à relire`,
      );
      continue;
    }
    const estQuestion = /\?\s*$/.test(titre);
    if (estQuestion) {
      h.textContent = question(langue);
      corps.forEach((el) => el.remove());
      h.after(creerP(d, langue));
      modifie = true;
    } else if (niv <= 3) {
      corps.forEach((el) => el.remove());
      h.replaceWith(creerP(d, langue));
      modifie = true;
    } else {
      ambigus.push(`titre H${niv} à reformuler : « ${titre} »`);
    }
  }
  return modifie;
}

/** `<details><summary>question</summary>réponse</details>` : même règle que les FAQ. */
function traiterDetails(racine: Element, d: Document, langue: Langue): boolean {
  let modifie = false;
  for (const det of Array.from(racine.querySelectorAll("details"))) {
    const sum = det.querySelector("summary");
    if (!sum) continue;
    const q = (sum.textContent ?? "").trim();
    const reste = Array.from(det.children).filter((c) => c !== sum);
    const rep = reste.map((c) => c.outerHTML).join("");
    if (!estVisee(q) && !estVisee(htmlVersTexte(rep))) continue;
    if (estVisee(q) || TITRE_FINANCEMENT.test(normaliser(q))) {
      sum.textContent = question(langue);
      reste.forEach((c) => c.remove());
      det.append(creerP(d, langue));
      modifie = true;
    }
  }
  return modifie;
}

/** Intro d'une liste (« les sept étapes : ») : corrige le décompte quand des puces sont retirées. */
function corrigerIntroDecompte(
  intro: Element | null,
  avant: number,
  retirees: number,
  ambigus: string[],
): void {
  if (!intro || intro.tagName !== "P" || retirees === 0) return;
  const html = intro.innerHTML;
  let dernier: RegExpMatchArray | null = null;
  for (const m of html.matchAll(DECOMPTE)) dernier = m;
  if (!dernier || dernier.index === undefined) return;
  if (!/[:：]\s*$/.test(htmlVersTexte(html))) return;
  const n = valeurNombre(dernier[1]!);
  if (n !== avant || n - retirees < 2) {
    ambigus.push(`décompte à vérifier : « ${dernier[0]} » (${avant} puces)`);
    return;
  }
  const nouveau = ecrireNombre(n - retirees, dernier[1]!);
  noter(`décompte corrigé : « ${dernier[1]} ${dernier[2]} » → « ${nouveau} ${dernier[2]} »`);
  intro.innerHTML =
    html.slice(0, dernier.index) +
    `${nouveau} ${dernier[2]}` +
    html.slice(dernier.index + dernier[0].length);
}

const INTRO_FINANCEMENT = /financ|\bfund|prise en charge/i;

/** Puce qui parle de financement au sens organisme payeur (fonds, subvention, financé par…). */
const PUCE_FINANCEUR = /financ|\bfund|\bfonds\b|subvention/i;

function traiterListes(racine: Element, d: Document, langue: Langue, ambigus: string[]): boolean {
  let modifie = false;
  for (const liste of Array.from(racine.querySelectorAll("ul, ol"))) {
    if (!liste.isConnected || liste.querySelector("ul, ol, table")) continue;
    const items = Array.from(liste.children).filter((c) => c.tagName === "LI");
    if (items.length === 0) continue;
    const visees = items.filter(
      (li) =>
        htmlVersTexte(li.innerHTML) !== "" &&
        phrases(htmlVersTexte(li.innerHTML)).some((p) => estVisee(p)),
    );
    if (visees.length === 0) continue;
    const intro = liste.previousElementSibling;
    // Liste entière remplacée seulement si TOUTES ses puces parlent de financement au sens
    // ORGANISME PAYEUR : « coût », « budget », « tarif », « prix », « € » ne suffisent pas, la
    // puce visée part seule.
    const introFinancement =
      items.every(
        (li) => visees.includes(li) || PUCE_FINANCEUR.test(normaliser(htmlVersTexte(li.innerHTML))),
      ) &&
      items.every((li) => textePur(htmlVersTexte(li.innerHTML))) &&
      !!intro &&
      intro.tagName === "P" &&
      /:\s*$/.test((intro.textContent ?? "").trim()) &&
      INTRO_FINANCEMENT.test(normaliser(intro.textContent ?? ""));
    if (introFinancement && intro) {
      intro.remove();
      liste.replaceWith(creerP(d, langue));
      modifie = true;
      continue;
    }
    // Une puce : fragment retiré (texte simple), retirée seulement si elle est PURE (le sujet est le
    // financement) ; toute autre puce visée est ambiguë et reste en place.
    let retirees = 0;
    let change = false;
    for (const li of visees) {
      const sortie = verdictPuce(li.innerHTML, true);
      if (sortie.type === "modifie") {
        if (sortie.html) li.innerHTML = sortie.texte;
        else li.textContent = sortie.texte;
        change = true;
      } else if (sortie.type === "ambigu") ambigus.push(sortie.ambigu ?? "puce ambiguë");
      else if (sortie.type === "retire") {
        li.remove();
        retirees++;
        change = true;
      }
    }
    if (retirees === items.length) liste.replaceWith(creerP(d, langue));
    else corrigerIntroDecompte(intro, items.length, retirees, ambigus);
    if (change) modifie = true;
  }
  return modifie;
}

/**
 * Cellule de tableau dont le texte ne porte qu'un mot de financement : « Sur devis OPCO » →
 * « Sur devis », « Oui (OPCO) » → « Oui ». `null` si le résultat n'est pas propre.
 */
function nettoyerCellule(texte: string): string | null {
  const t = retirerFragments(texte).trim();
  const sans = t
    .replace(
      /\s*(?:[-–—/+&,]\s*|\b(?:et|ou)\s+)?(?:OPCOs?|CPF|France Travail|Qualiopi|FNE-Formation|\bAIF)\s*$/i,
      "",
    )
    .trim();
  if (sans === "" || estVisee(sans) || MOTS_PENDANTS.test(sans)) return null;
  return sans;
}

function traiterTableaux(racine: Element, ambigus: string[]): boolean {
  let modifie = false;
  const lignes = Array.from(racine.querySelectorAll("tbody tr, table > tr"));
  const retirees = new Set<Element>();
  for (const tr of lignes) {
    const cellules = Array.from(tr.children);
    if (cellules.length === 0) continue;
    const autres = cellules.slice(1).map((c) => c.textContent ?? "");
    const v = verdictLigne(cellules[0]!.textContent ?? "", autres);
    if (v === "retirer") {
      if (!cellules.every((c) => textePur(c.textContent ?? ""))) {
        ambigus.push(
          `tableau : ligne mêlant financement et autre contenu, à relire : « ${(tr.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 100)} »`,
        );
        continue;
      }
      // Dernière ligne de son tableau : le tableau resterait sans ligne → ambigu, ligne gardée.
      const table = tr.closest("table");
      if (lignes.every((x) => x === tr || retirees.has(x) || x.closest("table") !== table)) {
        ambigus.push(
          `tableau : la seule ligne restante est visée, le tableau resterait vide, à relire : « ${(tr.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 100)} »`,
        );
        continue;
      }
      tr.remove();
      retirees.add(tr);
      modifie = true;
    } else if (v === "ambigu") {
      // Cellule hors première colonne : retrait ciblé du mot de financement, sinon ambigu.
      const aNettoyer = cellules.slice(1).filter((c) => estVisee(c.textContent ?? ""));
      const propres = aNettoyer.map((c) => nettoyerCellule(c.innerHTML));
      if (propres.every((x) => x !== null)) {
        aNettoyer.forEach((c, i) => {
          noter(
            `cellule de tableau : « ${(c.textContent ?? "").trim()} » → « ${htmlVersTexte(propres[i]!)} »`,
          );
          c.innerHTML = propres[i]!;
        });
        modifie = true;
        continue;
      }
      const autre = autres.find((c) => estVisee(c)) ?? "";
      ambigus.push(
        `tableau : cellule visée hors première colonne : « ${autre.trim().slice(0, 100)} »`,
      );
    }
  }
  return modifie;
}

function traiterFeuilles(racine: Element, langue: Langue, ambigus: string[]): boolean {
  let modifie = false;
  const feuilles = Array.from(
    racine.querySelectorAll("p, li, dd, dt, figcaption, blockquote, h4, h5, h6"),
  ).filter((el) => !el.querySelector(BLOCS_STRUCTURE));
  for (const el of feuilles) {
    if (!el.isConnected) continue;
    if (el.tagName === "P" && estPhraseStandard(el)) continue;
    const niv = niveau(el);
    if (niv >= 4) {
      const t = (el.textContent ?? "").trim();
      if (estVisee(t)) ambigus.push(`titre H${niv} à reformuler : « ${t} »`);
      continue;
    }
    const b = traiterBloc(el.innerHTML, langue, true);
    ambigus.push(...b.ambigus);
    if (!b.modifie) continue;
    if (b.vide) el.remove();
    else el.innerHTML = b.contenu;
    modifie = true;
  }
  return modifie;
}

/** Retire les phrases standard consécutives en double (deux sections voisines remplacées). */
function dedoublonner(racine: Element): boolean {
  let modifie = false;
  for (const p of Array.from(racine.querySelectorAll("p"))) {
    if (!p.isConnected || !estPhraseStandard(p)) continue;
    const suivant = p.nextElementSibling;
    if (estPhraseStandard(suivant)) {
      suivant!.remove();
      modifie = true;
    }
  }
  return modifie;
}

/**
 * Réécrit un corps HTML. Renvoie la chaîne d'ORIGINE, octet pour octet, si rien ne change
 * (pas de sérialisation parasite). Idempotent.
 */
export function reecrireHtml(html: string, langue: Langue): Resultat {
  const c = decomptesCorriges;
  const r = reecrireHtmlInterne(html, langue);
  return verrouiller(r, html, htmlVersTexte(html), () => htmlVersTexte(r.valeur), c);
}

function reecrireHtmlInterne(html: string, langue: Langue): Resultat {
  const fenetre = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  const d = fenetre.document;
  const racine = d.body;
  const ambigus: string[] = [];
  let modifie = false;
  modifie = reecrireLiens(racine, langue) || modifie;
  modifie = traiterDetails(racine, d, langue) || modifie;
  modifie = traiterTitres(racine, d, langue, ambigus) || modifie;
  modifie = traiterListes(racine, d, langue, ambigus) || modifie;
  modifie = traiterTableaux(racine, ambigus) || modifie;
  modifie = traiterFeuilles(racine, langue, ambigus) || modifie;
  modifie = dedoublonner(racine) || modifie;
  const sortie = modifie ? racine.innerHTML : html;
  fenetre.close();
  return { valeur: sortie, modifie, ambigus: [...new Set(ambigus)] };
}

// ───────────────────────────── Tiptap JSON ─────────────────────────────

interface NoeudTiptap {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: NoeudTiptap[];
  [k: string]: unknown;
}

function texteNoeud(n: NoeudTiptap): string {
  if (typeof n.text === "string") return n.text;
  return (n.content ?? []).map(texteNoeud).join("");
}

function paragrapheStandard(langue: Langue): NoeudTiptap {
  return { type: "paragraph", content: [{ type: "text", text: phrase(langue) }] };
}

/**
 * Document Tiptap : mêmes règles que le HTML, au niveau des paragraphes, listes et sections
 * (titres H2/H3), lignes de tableau et liens vers les pages retirées (même règle que le HTML).
 * Un paragraphe réécrit perd ses marques en ligne (gras, lien) ; un paragraphe intact est
 * conservé tel quel.
 */
export function reecrireJson(documentJson: unknown, langue: Langue): Resultat<unknown> {
  const c = decomptesCorriges;
  const r = reecrireJsonInterne(documentJson, langue);
  return verrouiller(
    r,
    documentJson,
    blocsTexteJson(documentJson).join(" "),
    () => blocsTexteJson(r.valeur).join(" "),
    c,
  );
}

function reecrireJsonInterne(documentJson: unknown, langue: Langue): Resultat<unknown> {
  // JSON stocké sous forme de CHAÎNE : on l'analyse, on réécrit, on re-sérialise (même type).
  if (typeof documentJson === "string") {
    let analyse: unknown;
    try {
      analyse = JSON.parse(documentJson);
    } catch {
      return { valeur: documentJson, modifie: false, ambigus: [] };
    }
    if (!analyse || typeof analyse !== "object")
      return { valeur: documentJson, modifie: false, ambigus: [] };
    const r = reecrireJsonInterne(analyse, langue);
    return { ...r, valeur: r.modifie ? JSON.stringify(r.valeur) : documentJson };
  }
  // Tableau de nœuds sans racine « doc » : on l'enveloppe, puis on le déballe.
  if (Array.isArray(documentJson)) {
    const r = reecrireJsonInterne({ type: "doc", content: documentJson }, langue);
    return {
      ...r,
      valeur: r.modifie ? ((r.valeur as NoeudTiptap).content ?? []) : documentJson,
    };
  }
  if (!documentJson || typeof documentJson !== "object")
    return { valeur: documentJson, modifie: false, ambigus: [] };
  const racine = structuredClone(documentJson) as NoeudTiptap;
  const ambigus: string[] = [];
  let modifie = false;

  /** Liens vers les pages retirées : même réécriture que le HTML (href et, si besoin, texte). */
  const reecrireLiensJson = (n: NoeudTiptap): void => {
    const marques = Array.isArray(n.marks) ? (n.marks as NoeudTiptap[]) : [];
    for (const m of marques) {
      const href = typeof m.attrs?.href === "string" ? m.attrs.href : "";
      if (m.type !== "link" || !LIENS_RETIRES.test(href)) continue;
      m.attrs = { ...m.attrs, href: hrefReecrit(href) };
      if (typeof n.text === "string" && texteLienARemplacer(n.text))
        n.text = texteLienRemplace(langue);
      modifie = true;
    }
    for (const c of n.content ?? []) reecrireLiensJson(c);
  };
  reecrireLiensJson(racine);

  /** Tableau : mêmes retraits de lignes que le HTML (lignes d'en-tête exclues). */
  const traiterTableauJson = (t: NoeudTiptap): void => {
    t.content = (t.content ?? []).filter((ligne) => {
      const cellules = ligne.content ?? [];
      if (cellules.length === 0 || cellules.every((c) => c.type === "tableHeader")) return true;
      const v = verdictLigne(texteNoeud(cellules[0]!), cellules.slice(1).map(texteNoeud));
      if (v === "retirer") {
        if (!cellules.every((c) => textePur(texteNoeud(c)))) {
          ambigus.push(
            `tableau : ligne mêlant financement et autre contenu, à relire : « ${cellules.map(texteNoeud).join(" ").slice(0, 100)} »`,
          );
          return true;
        }
        modifie = true;
        return false;
      }
      if (v === "ambigu") {
        const aNettoyer = cellules.slice(1).filter((c) => estVisee(texteNoeud(c)));
        const propres = aNettoyer.map((c) => nettoyerCellule(texteNoeud(c)));
        if (propres.every((x) => x !== null)) {
          aNettoyer.forEach((c, i) => {
            noter(`cellule de tableau : « ${texteNoeud(c).trim()} » → « ${propres[i]} »`);
            c.content = [{ type: "paragraph", content: [{ type: "text", text: propres[i]! }] }];
          });
          modifie = true;
          return true;
        }
        const autre =
          cellules
            .slice(1)
            .map(texteNoeud)
            .find((c) => estVisee(c)) ?? "";
        ambigus.push(
          `tableau : cellule visée hors première colonne : « ${autre.trim().slice(0, 100)} »`,
        );
      }
      return true;
    });
  };

  const traiterParagraphe = (n: NoeudTiptap): "garde" | "modifie" | "vide" => {
    const t = texteNoeud(n);
    if (t === PHRASE_FR || t === PHRASE_EN) return "garde";
    const b = traiterBloc(t, langue, false);
    ambigus.push(...b.ambigus);
    if (!b.modifie) return "garde";
    if (b.vide) return "vide";
    n.content = [{ type: "text", text: b.contenu }];
    return "modifie";
  };

  /** Bloc de texte « inattendu » (listItem, tableCell… portant directement du texte). */
  const estBlocTexte = (n: NoeudTiptap): boolean =>
    !!n.content &&
    n.content.length > 0 &&
    n.content.every((x) => x.type === "text" || x.type === "hardBreak");

  const traiterConteneur = (n: NoeudTiptap): void => {
    const enfants = n.content ?? [];
    const sortie: NoeudTiptap[] = [];
    for (let i = 0; i < enfants.length; i++) {
      const c = enfants[i]!;
      if (c.type === "heading") {
        const niv = Number((c.attrs as { level?: number } | undefined)?.level ?? 0);
        const titre = texteNoeud(c).trim();
        if (niv >= 2 && niv <= 4) {
          let fin = i + 1;
          while (fin < enfants.length) {
            const e = enfants[fin]!;
            const ne =
              e.type === "heading"
                ? Number((e.attrs as { level?: number } | undefined)?.level ?? 0)
                : 0;
            if (ne > 0 && ne <= niv) break;
            fin++;
          }
          const corps = enfants.slice(i + 1, fin);
          const corpsVise = corps.some((e) => phrases(texteNoeud(e)).some((p) => estVisee(p)));
          const concerne =
            estVisee(titre) || (TITRE_FINANCEMENT.test(normaliser(titre)) && corpsVise);
          if (concerne && !corps.every((e) => textePur(texteNoeud(e)))) {
            ambigus.push(
              `section « ${titre.slice(0, 100)} » : financement mêlé à un autre sujet, à relire`,
            );
          } else if (concerne) {
            const estQuestion = /\?\s*$/.test(titre);
            if (estQuestion) {
              sortie.push(
                { ...c, content: [{ type: "text", text: question(langue) }] },
                paragrapheStandard(langue),
              );
              modifie = true;
              i = fin - 1;
              continue;
            }
            if (niv <= 3) {
              sortie.push(paragrapheStandard(langue));
              modifie = true;
              i = fin - 1;
              continue;
            }
            ambigus.push(`titre H${niv} à reformuler : « ${titre} »`);
          }
        }
        sortie.push(c);
        continue;
      }
      if (c.type === "paragraph") {
        const r = traiterParagraphe(c);
        if (r === "vide") {
          modifie = true;
          continue;
        }
        if (r === "modifie") modifie = true;
        sortie.push(c);
        continue;
      }
      if (c.type === "bulletList" || c.type === "orderedList") {
        const items = c.content ?? [];
        const visees = items.filter((li) => phrases(texteNoeud(li)).some((p) => estVisee(p)));
        if (visees.length === 0) {
          sortie.push(c);
          continue;
        }
        const prec = sortie[sortie.length - 1];
        const introFinancement =
          items.every((li) => textePur(texteNoeud(li))) &&
          !!prec &&
          prec.type === "paragraph" &&
          /:\s*$/.test(texteNoeud(prec).trim()) &&
          INTRO_FINANCEMENT.test(normaliser(texteNoeud(prec)));
        if (introFinancement) {
          sortie.pop();
          sortie.push(paragrapheStandard(langue));
          modifie = true;
          continue;
        }
        const retirees: NoeudTiptap[] = [];
        let change = false;
        for (const li of visees) {
          const sortiePhrase = verdictPuce(texteNoeud(li), false);
          if (sortiePhrase.type === "modifie") {
            li.content = [
              { type: "paragraph", content: [{ type: "text", text: sortiePhrase.texte }] },
            ];
            change = true;
          } else if (sortiePhrase.type === "ambigu") {
            ambigus.push(sortiePhrase.ambigu ?? "puce ambiguë");
          } else if (sortiePhrase.type === "retire") {
            retirees.push(li);
            change = true;
          }
        }
        c.content = items.filter((li) => !retirees.includes(li));
        if (c.content.length === 0) sortie.push(paragrapheStandard(langue));
        else {
          sortie.push(c);
          const prev = sortie[sortie.length - 2];
          if (retirees.length > 0 && prev?.type === "paragraph") {
            const t = texteNoeud(prev);
            let dernier: RegExpMatchArray | null = null;
            for (const m of t.matchAll(DECOMPTE)) dernier = m;
            if (dernier && dernier.index !== undefined && /[:：]\s*$/.test(t.trim())) {
              const n = valeurNombre(dernier[1]!);
              if (n === items.length && n - retirees.length >= 2) {
                const nouveau = ecrireNombre(n - retirees.length, dernier[1]!);
                noter(
                  `décompte corrigé : « ${dernier[1]} ${dernier[2]} » → « ${nouveau} ${dernier[2]} »`,
                );
                prev.content = [
                  {
                    type: "text",
                    text:
                      t.slice(0, dernier.index) +
                      `${nouveau} ${dernier[2]}` +
                      t.slice(dernier.index + dernier[0].length),
                  },
                ];
              } else
                ambigus.push(`décompte à vérifier : « ${dernier[0]} » (${items.length} puces)`);
            }
          }
        }
        if (change) modifie = true;
        continue;
      }
      if (c.type === "table") {
        traiterTableauJson(c);
        sortie.push(c);
        continue;
      }
      if (c.type !== "heading" && estBlocTexte(c)) {
        const r = traiterParagraphe(c);
        if (r === "vide") {
          modifie = true;
          continue;
        }
        if (r === "modifie") modifie = true;
        sortie.push(c);
        continue;
      }
      if (c.content) traiterConteneur(c);
      sortie.push(c);
    }
    // Phrases standard consécutives en double.
    n.content = sortie.filter(
      (e, i) =>
        !(
          i > 0 &&
          texteNoeud(e) === texteNoeud(sortie[i - 1]!) &&
          (texteNoeud(e) === PHRASE_FR || texteNoeud(e) === PHRASE_EN)
        ),
    );
  };

  traiterConteneur(racine);
  if (!modifie) return { valeur: documentJson, modifie: false, ambigus: [...new Set(ambigus)] };
  return { valeur: racine, modifie: true, ambigus: [...new Set(ambigus)] };
}

// ───────────────────────────── classement ─────────────────────────────

export type Classe = "propre" | "a-reecrire" | "ambigu";

/** Classe un résultat : propre (rien à faire), à réécrire, ou ambigu (humain, cf. overrides). */
export function classer(r: Resultat<unknown>): Classe {
  if (r.ambigus.length > 0) return "ambigu";
  return r.modifie ? "a-reecrire" : "propre";
}

// ───────────────────────────── bodyJson : mention restante ─────────────────────────────

/** Blocs de texte d'un document Tiptap (ou d'une chaîne JSON) : un par nœud portant du texte. */
export function blocsTexteJson(valeur: unknown): string[] {
  if (typeof valeur === "string") {
    try {
      const a: unknown = JSON.parse(valeur);
      return a && typeof a === "object" ? blocsTexteJson(a) : [];
    } catch {
      return [];
    }
  }
  const blocs: string[] = [];
  const marcher = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(marcher);
    if (!n || typeof n !== "object") return;
    const nt = n as NoeudTiptap;
    const enfants = Array.isArray(nt.content) ? nt.content : [];
    if (enfants.some((c) => c && typeof c.text === "string")) {
      blocs.push(texteNoeud(nt));
      return;
    }
    // Structure inattendue : on descend dans toutes les valeurs (content, data, attrs…).
    for (const v of Object.values(nt)) if (v && typeof v === "object") marcher(v);
  };
  marcher(valeur);
  return blocs;
}

/** Le document Tiptap porte-t-il encore (ou déjà) une phrase visée ? */
export function jsonContientMention(valeur: unknown): boolean {
  return blocsTexteJson(valeur).some((b) => phrases(b).some((p) => estVisee(p)) || estVisee(b));
}
