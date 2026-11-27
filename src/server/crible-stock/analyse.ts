/**
 * V2-14 — crible du stock d'articles publiés : l'ANALYSE, module pur (ni base, ni réseau).
 *
 * Pour chaque article, cinq familles de constats :
 *   - `chiffre-sans-source`      un pourcentage ou un ordre de grandeur sans source à portée ;
 *   - `citation-non-attribuee`   une citation entre guillemets ou un `<blockquote>` sans auteur ;
 *   - `citation-expert-nommee`   l'avis d'expert est signé d'une personne (le texte vient d'un modèle) ;
 *   - `definition-absente`       pas de définition en tête, pas de `<dfn>` ;
 *   - `lien-glossaire-absent`    aucun lien vers le glossaire ;
 *   - `phrase-interdite`         les motifs de la doctrine (`detecterInterditsSurface`).
 *
 * Seules deux corrections sont automatiques, et elles ne touchent que les champs de l'avis
 * d'expert de la table `articles` (jamais le corps) :
 *   - RÉATTRIBUER un avis signé d'une personne à « Point de vue d'Axion-IA » (le texte reste) ;
 *   - RETIRER un avis dont le texte porte un interdit de la doctrine (le rendu le masque déjà).
 * Tout le reste est LISTÉ, rien d'autre. Les articles exclus (décision de Williams, voir
 * `exclusions.ts`) ne reçoivent AUCUNE correction.
 *
 * Les heuristiques (chiffre, citation, définition) sont volontairement prudentes et ne servent
 * qu'à produire une liste à relire : aucune ne déclenche d'écriture.
 */
import {
  detecterInterdits,
  detecterInterditsSurface,
  normaliserPourControle,
  type CodeInterdit,
} from "../../lib/contenu/interdits-publication";
import { raisonExclusion, type RaisonExclusion } from "./exclusions";

/** Signature d'un avis d'expert écrit par un modèle (même valeur que `SIGNATURE_AVIS`, vérifiée par un test). */
export const SIGNATURE_NOM = "Axion-IA";
export const SIGNATURE_TITRE = "Point de vue d'Axion-IA";

export type CodeConstat =
  | "chiffre-sans-source"
  | "citation-non-attribuee"
  | "citation-expert-nommee"
  | "definition-absente"
  | "lien-glossaire-absent"
  | "phrase-interdite";

export interface Constat {
  readonly code: CodeConstat;
  /** Pour `phrase-interdite` : le motif de la doctrine. */
  readonly motif?: CodeInterdit;
  readonly champ?: string;
  readonly extrait: string;
}

export interface ArticleACribler {
  readonly id: string;
  readonly slug: string;
  readonly titre: string;
  readonly corpsHtml: string;
  readonly directAnswer: string | null;
  readonly keyTakeaway: string | null;
  readonly expertNom: string | null;
  readonly expertTitre: string | null;
  readonly expertTexte: string | null;
  readonly isNews: boolean;
}

export type Correction =
  | {
      readonly type: "reattribuer-avis";
      readonly avant: Champs;
      readonly apres: Champs;
    }
  | {
      readonly type: "retirer-avis";
      readonly avant: Champs;
      readonly apres: Champs;
    };

/** Les trois champs de l'avis d'expert (colonnes de `articles`). */
export interface Champs {
  readonly expertQuoteName: string | null;
  readonly expertQuoteTitle: string | null;
  readonly expertQuoteText: string | null;
}

export interface ResultatArticle {
  readonly id: string;
  readonly slug: string;
  readonly titre: string;
  readonly constats: ReadonlyArray<Constat>;
  /** `null` : l'article peut être corrigé. Sinon : exclu de toute correction, et pourquoi. */
  readonly exclusion: RaisonExclusion | null;
  /** Toujours `null` pour un article exclu. */
  readonly correction: Correction | null;
}

// ───────────────────────────── texte ─────────────────────────────

const ENTITES: Readonly<Record<string, string>> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&laquo;": "«",
  "&raquo;": "»",
  "&euro;": "€",
};

export function texteBrut(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|quot|#39|apos|lt|gt|laquo|raquo|euro);/g, (m) => ENTITES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function coupe(s: string, n = 160): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Blocs de texte (paragraphes, items, cellules, titres) du HTML, en HTML brut pour garder les liens. */
function blocs(html: string): string[] {
  return html
    .split(/<\/(?:p|li|td|th|h[1-6]|blockquote|figcaption)>|<br\s*\/?>/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

// ───────────────────────────── chiffres sans source ─────────────────────────────

/** Un pourcentage, un « x fois plus/moins », un ordre de grandeur en millions/milliards. */
const CHIFFRE =
  /(?:\d[\d\s.,]*\s?(?:%|pour cent)|\b\d[\d\s.,]*\s?(?:millions?|milliards?)\b|\b\d+(?:[.,]\d+)?\s?fois (?:plus|moins))/i;

/** Indices qu'une source est à portée : lien externe, « selon », « source : », « (Nom, 2024) ». */
const INDICE_SOURCE =
  /<a\s[^>]*href=["']https?:|\bselon\b|d['’]apr[eè]s|\bsources?\s?:|\b(?:insee|eurostat|bpifrance|dares|cnil|ocde|mckinsey|gartner|statista|france travail|commission europ[eé]enne)\b|\([^()]{2,60}[,\s](?:19|20)\d{2}\)|\b(?:etude|étude|rapport|barom[eè]tre|enqu[eê]te)\s+(?:de|du|d['’]|des|annuel)/i;

export function chiffresSansSource(html: string, max = 12): Constat[] {
  const out: Constat[] = [];
  for (const bloc of blocs(html)) {
    const texte = texteBrut(bloc);
    const m = CHIFFRE.exec(texte);
    if (!m) continue;
    if (INDICE_SOURCE.test(bloc)) continue;
    out.push({ code: "chiffre-sans-source", extrait: coupe(texte) });
    if (out.length >= max) break;
  }
  return out;
}

// ───────────────────────────── citations ─────────────────────────────

const CITATION_GUILLEMETS = /«\s?([^»]{30,400}?)\s?»|"([^"]{40,400}?)"/g;
const INDICE_ATTRIBUTION =
  /\b(?:selon|d['’]apr[eè]s|d[eé]clare|d[eé]clarent|explique|expliquent|affirme|souligne|t[eé]moigne|note|estime|[eé]crit|confie|pr[eé]cise)\b|<cite|—|–|\bpoint de vue d['’]axion-ia\b/i;

export function citationsNonAttribuees(html: string, max = 8): Constat[] {
  const out: Constat[] = [];
  // 1) `<blockquote>` sans `<cite>` ni tiret d'attribution.
  for (const m of html.matchAll(/<blockquote[\s\S]*?<\/blockquote>/gi)) {
    if (!INDICE_ATTRIBUTION.test(m[0]))
      out.push({ code: "citation-non-attribuee", extrait: coupe(texteBrut(m[0])) });
  }
  // 2) Citation entre guillemets : un indice d'attribution doit se trouver juste avant ou après.
  const texte = texteBrut(html);
  for (const m of texte.matchAll(CITATION_GUILLEMETS)) {
    const debut = m.index ?? 0;
    const fin = debut + m[0].length;
    const voisinage = `${texte.slice(Math.max(0, debut - 110), debut)} ${texte.slice(fin, fin + 110)}`;
    if (!INDICE_ATTRIBUTION.test(voisinage))
      out.push({ code: "citation-non-attribuee", extrait: coupe(m[0]) });
  }
  return out.slice(0, max);
}

// ───────────────────────────── définition et glossaire ─────────────────────────────

const VERBE_DEFINITION =
  /\b(?:est|sont|d[eé]signe|d[eé]signent|correspond|consiste|se d[eé]finit|repr[eé]sente|permet de|un ensemble de)\b/i;

/** Pas de `<dfn>` et pas de phrase de définition dans la réponse directe ou les deux premières phrases du corps. */
export function definitionAbsente(a: ArticleACribler): Constat | null {
  if (/<dfn[\s>]/i.test(a.corpsHtml)) return null;
  const debut = texteBrut(a.corpsHtml)
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ");
  const tete = `${a.directAnswer ?? ""} ${debut}`;
  if (VERBE_DEFINITION.test(tete.slice(0, 500))) return null;
  return { code: "definition-absente", extrait: coupe(tete || a.titre) };
}

export function glossaireAbsent(html: string): Constat | null {
  return /href=["'](?:https?:\/\/[^"']*)?\/(?:[a-z]{2}\/)?(?:glossaire|glossary)(?:[/"'#?])/i.test(
    html,
  )
    ? null
    : { code: "lien-glossaire-absent", extrait: "aucun lien vers /glossaire dans le corps" };
}

// ───────────────────────────── phrases interdites ─────────────────────────────

export function phrasesInterdites(a: ArticleACribler): Constat[] {
  const champs: Record<string, string | undefined> = {
    titre: a.titre,
    reponseDirecte: a.directAnswer ?? undefined,
    pointCle: a.keyTakeaway ?? undefined,
    avis: a.expertTexte ?? undefined,
    corps: texteBrut(a.corpsHtml),
  };
  const vus = new Set<string>();
  const out: Constat[] = [];
  for (const c of detecterInterditsSurface(champs, {
    actualite: a.isNews,
    financementPublicAutorise: false,
  })) {
    const cle = `${c.code}|${c.champ}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({
      code: "phrase-interdite",
      motif: c.code,
      champ: c.champ,
      extrait: coupe(c.extrait),
    });
  }
  return out;
}

// ───────────────────────────── avis d'expert ─────────────────────────────

const vide = (s: string | null | undefined): boolean => !s || s.trim().length === 0;

function avisNomme(a: ArticleACribler): boolean {
  if (vide(a.expertTexte) || vide(a.expertNom)) return false;
  return normaliserPourControle(a.expertNom ?? "").trim() !== normaliserPourControle(SIGNATURE_NOM);
}

/** Même contrôle strict que `ArticleExpertQuote` au rendu : un avis qui porte un interdit n'est pas affiché. */
function avisPorteUnInterdit(a: ArticleACribler): boolean {
  if (vide(a.expertTexte)) return false;
  return (
    detecterInterdits(a.expertTexte ?? "", { actualite: false, financementPublicAutorise: false })
      .length > 0
  );
}

function champsAvis(a: ArticleACribler): Champs {
  return {
    expertQuoteName: a.expertNom,
    expertQuoteTitle: a.expertTitre,
    expertQuoteText: a.expertTexte,
  };
}

/** La seule correction possible. Un article exclu n'en reçoit jamais. */
export function corrigerAvis(a: ArticleACribler): Correction | null {
  if (avisPorteUnInterdit(a)) {
    return {
      type: "retirer-avis",
      avant: champsAvis(a),
      apres: { expertQuoteName: null, expertQuoteTitle: null, expertQuoteText: null },
    };
  }
  if (avisNomme(a)) {
    return {
      type: "reattribuer-avis",
      avant: champsAvis(a),
      apres: {
        expertQuoteName: SIGNATURE_NOM,
        expertQuoteTitle: SIGNATURE_TITRE,
        expertQuoteText: a.expertTexte,
      },
    };
  }
  return null;
}

// ───────────────────────────── un article ─────────────────────────────

export function cribler(a: ArticleACribler): ResultatArticle {
  const constats: Constat[] = [
    ...phrasesInterdites(a),
    ...chiffresSansSource(a.corpsHtml),
    ...citationsNonAttribuees(a.corpsHtml),
  ];
  if (avisNomme(a)) {
    constats.push({
      code: "citation-expert-nommee",
      extrait: `signé « ${coupe(a.expertNom ?? "", 60)} » : ${coupe(a.expertTexte ?? "", 100)}`,
    });
  }
  if (!a.isNews) {
    const d = definitionAbsente(a);
    if (d) constats.push(d);
  }
  const g = glossaireAbsent(a.corpsHtml);
  if (g) constats.push(g);

  const exclusion = raisonExclusion(
    a.slug,
    // Le texte de l'avis lui-même ne rend pas l'article « à témoignage » : c'est ce qu'on corrige.
    constats.flatMap((c) => (c.motif && c.champ !== "avis" ? [c.motif] : [])),
  );
  // Un article exclu n'a AUCUNE correction, quoi qu'il contienne.
  const correction = exclusion ? null : corrigerAvis(a);
  return { id: a.id, slug: a.slug, titre: a.titre, constats, exclusion, correction };
}
