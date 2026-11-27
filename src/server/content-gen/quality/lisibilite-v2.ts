/**
 * Lisibilité V2 — mesure automatique (derrière `CONTENU_LISIBILITE_V2`).
 *
 * Module PUR (aucune base, aucun réseau). Il mesure, sur le corps HTML d'un article, ce qui rend
 * un texte facile à lire pour un dirigeant de petite ou moyenne entreprise : phrases courtes,
 * paragraphes courts, intertitres sous forme de questions, encadrés. Il ne remplace pas
 * `computeReadabilityFr` (score de Flesch) : il le complète avec des mesures plus parlantes.
 *
 * Interrupteur : la variable `CONTENU_LISIBILITE_V2` doit valoir exactement « true ». Éteint,
 * `controlerLisibiliteV2` rend toujours une liste vide : aucun contrôle neuf.
 */

import { computeReadabilityFr } from "./readability";

export type EnvLisibiliteV2 = Readonly<Record<string, string | undefined>>;

/** Interrupteur de la lisibilité V2 : la valeur doit être exactement « true ». */
export function lisibiliteV2Active(env: EnvLisibiliteV2 = process.env): boolean {
  return env.CONTENU_LISIBILITE_V2 === "true";
}

/** Moyenne maximale de mots par phrase (alignée sur `MOTS_PAR_PHRASE_MAX` de la rédaction). */
export const LISIBILITE_V2_MOTS_PAR_PHRASE_MAX = 22;
/** Une phrase de plus de 30 mots est « longue ». */
export const LISIBILITE_V2_PHRASE_LONGUE = 30;
/** Part maximale de phrases longues (de plus de 30 mots). */
export const LISIBILITE_V2_PART_PHRASES_LONGUES_MAX = 0.2;
/** Un paragraphe de plus de 120 mots est « long ». */
export const LISIBILITE_V2_PARAGRAPHE_LONG = 120;
/** Part maximale de paragraphes longs. */
export const LISIBILITE_V2_PART_PARAGRAPHES_LONGS_MAX = 0.25;
/** En dessous de ce nombre de mots, le texte est trop court pour juger de la mise en forme. */
export const LISIBILITE_V2_MOTS_MINIMUM_POUR_JUGER = 300;

/** Types d'articles longs où au moins un encadré balisé est attendu. */
export const TYPES_AVEC_ENCADRE_ATTENDU: ReadonlySet<string> = new Set([
  "blog_article",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "barometer_insight",
]);

export interface MesureLisibiliteV2 {
  readonly motsParPhrase: number;
  readonly partPhrasesLongues: number;
  readonly nombrePhrases: number;
  readonly nombreParagraphes: number;
  readonly partParagraphesLongs: number;
  readonly nombreIntertitres: number;
  readonly partIntertitresQuestions: number;
  /** Nombre d'encadrés balisés (classes `ax-encadre`, `ax-stat` ou `callout`). */
  readonly nombreEncadres: number;
  readonly mots: number;
}

export type CodeLisibiliteV2 =
  "lisibilite-phrases-longues" | "lisibilite-paragraphes-longs" | "lisibilite-sans-encadre";

export interface ProblemeLisibiliteV2 {
  readonly code: CodeLisibiliteV2;
  /** Libellé en français simple, repris dans le journal et le retour qualité. */
  readonly message: string;
}

const NBSP = /[\u00a0\u202f\u2007]/g;

const enTexte = (html: string): string =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(NBSP, " ")
    .replace(/\s+/g, " ")
    .trim();

const compterMots = (texte: string): number =>
  texte.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;

/** Découpe en phrases : le point final d'un titre ou d'un élément de liste compte comme fin. */
function phrasesDe(html: string): string[] {
  const balisee = html
    .replace(/<\/(p|li|h[1-6]|div|td|th|blockquote|dd|dt|figcaption)>/gi, ". ")
    .replace(/<(table|ul|ol|aside|section)\b/gi, ". <$1");
  return enTexte(balisee)
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.replace(/^[.\s]+/, "").trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

function contenuDesBalises(html: string, balise: string): string[] {
  const motif = new RegExp(`<${balise}\\b[^>]*>([\\s\\S]*?)<\\/${balise}>`, "gi");
  return [...html.matchAll(motif)].map((m) => enTexte(m[1] ?? ""));
}

/** Un intertitre est une question s'il se termine par « ? » (espace insécable permise). */
const estQuestion = (titre: string): boolean => /\?\s*$/.test(titre.replace(NBSP, " "));

/** Mesure un corps HTML. Un texte vide rend des zéros. */
export function mesurerLisibiliteV2(html: string): MesureLisibiliteV2 {
  const phrases = phrasesDe(html);
  const longueurs = phrases.map(compterMots);
  const totalMots = longueurs.reduce((a, b) => a + b, 0);
  const longues = longueurs.filter((n) => n > LISIBILITE_V2_PHRASE_LONGUE).length;

  const paragraphes = contenuDesBalises(html, "p").filter((p) => p.length > 0);
  const longs = paragraphes.filter((p) => compterMots(p) > LISIBILITE_V2_PARAGRAPHE_LONG).length;

  const intertitres = [...contenuDesBalises(html, "h2"), ...contenuDesBalises(html, "h3")];
  const questions = intertitres.filter(estQuestion).length;

  const encadres = (
    html.match(/<(?:aside|section|div)\b[^>]*\bclass="[^"]*\b(?:ax-encadre|ax-stat|callout)\b/gi) ??
    []
  ).length;

  return {
    motsParPhrase: phrases.length > 0 ? Number((totalMots / phrases.length).toFixed(2)) : 0,
    partPhrasesLongues: phrases.length > 0 ? Number((longues / phrases.length).toFixed(3)) : 0,
    nombrePhrases: phrases.length,
    nombreParagraphes: paragraphes.length,
    partParagraphesLongs:
      paragraphes.length > 0 ? Number((longs / paragraphes.length).toFixed(3)) : 0,
    nombreIntertitres: intertitres.length,
    partIntertitresQuestions:
      intertitres.length > 0 ? Number((questions / intertitres.length).toFixed(3)) : 0,
    nombreEncadres: encadres,
    mots: compterMots(enTexte(html)),
  };
}

/**
 * Contrôles de lisibilité V2. Liste vide = rien à signaler, ou interrupteur éteint.
 *
 * Seuils volontairement tolérants : ils ne signalent que les textes réellement pénibles. Les
 * intertitres en question sont demandés au rédacteur mais NE SONT PAS un motif de signalement
 * (un titre qui n'est pas une question reste un bon titre).
 */
export function controlerLisibiliteV2(
  html: string,
  env: EnvLisibiliteV2 = process.env,
  contentType?: string,
): ProblemeLisibiliteV2[] {
  if (!lisibiliteV2Active(env)) return [];
  const m = mesurerLisibiliteV2(html);
  if (m.mots < LISIBILITE_V2_MOTS_MINIMUM_POUR_JUGER) return [];
  const problemes: ProblemeLisibiliteV2[] = [];

  if (
    m.motsParPhrase > LISIBILITE_V2_MOTS_PAR_PHRASE_MAX ||
    m.partPhrasesLongues > LISIBILITE_V2_PART_PHRASES_LONGUES_MAX
  ) {
    problemes.push({
      code: "lisibilite-phrases-longues",
      message: `phrases trop longues : ${m.motsParPhrase.toFixed(1)} mots en moyenne (maximum ${LISIBILITE_V2_MOTS_PAR_PHRASE_MAX}), ${Math.round(m.partPhrasesLongues * 100)} % de phrases de plus de ${LISIBILITE_V2_PHRASE_LONGUE} mots (maximum ${Math.round(LISIBILITE_V2_PART_PHRASES_LONGUES_MAX * 100)} %) — couper, une idée par phrase`,
    });
  }
  if (m.partParagraphesLongs > LISIBILITE_V2_PART_PARAGRAPHES_LONGS_MAX) {
    problemes.push({
      code: "lisibilite-paragraphes-longs",
      message: `paragraphes trop longs : ${Math.round(m.partParagraphesLongs * 100)} % dépassent ${LISIBILITE_V2_PARAGRAPHE_LONG} mots (maximum ${Math.round(LISIBILITE_V2_PART_PARAGRAPHES_LONGS_MAX * 100)} %) — aérer`,
    });
  }
  // L'encadré n'est exigé que des articles longs (les FAQ, définitions et pages de données
  // sont courtes par nature) ; sans type connu, on ne l'exige pas.
  if (m.nombreEncadres === 0 && contentType && TYPES_AVEC_ENCADRE_ATTENDU.has(contentType)) {
    problemes.push({
      code: "lisibilite-sans-encadre",
      message:
        "aucun encadré balisé (classes ax-encadre, ax-stat ou callout) : ajouter au moins un encadré « À retenir » ou « En bref »",
    });
  }
  return problemes;
}

/** Score de Flesch du corps HTML (réutilise `computeReadabilityFr`), pour le journal. */
export function scoreFleschDuCorps(html: string): number {
  return computeReadabilityFr(enTexte(html)).score;
}
