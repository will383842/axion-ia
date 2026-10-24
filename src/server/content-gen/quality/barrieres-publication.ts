/**
 * Content Generator — barrières de publication (lot L2 de l'audit du 24/10/2026).
 *
 * Avant ce module, un article pouvait partir en publication automatique avec :
 * une « Section indisponible » dans le corps, moins de sections que le plan,
 * un corps de soft-404, aucun fait de la base de connaissances derrière lui,
 * ou une accroche recopiée sur un article déjà en ligne.
 *
 * Chaque barrière ENVOIE EN RELECTURE HUMAINE (`needs_review`) : aucune ne
 * dé-indexe quoi que ce soit. Décision de Will (17/06/2026) : « tout
 * indexable ». Le niveau d'indexation n'est donc PAS touché ici ; le plancher
 * de mots est une barrière de relecture, pas un noindex.
 *
 * Contient aussi :
 *  - le contrôle de surface rejoué par le worker de PUBLICATION à partir du JSON
 *    persisté (`sortieDepuisJson` + `controlerSurfacePublication`) ;
 *  - la décision de la garde de fact-check avant publication.
 *
 * Fonctions pures : aucune base, aucun Next.
 */

import {
  detecterInterditsSurface,
  type InterditSurface,
  type OptionsInterdits,
} from "@/lib/contenu/interdits-publication";
import type { GeneratorOutput } from "../generators/types";
import { verifierAccrocheTropProche } from "./anti-redite-accroche";
import { surfaceDepuisSortie, type SortiePourSurface } from "./doctrine-surface";
import { evaluateSoft404 } from "./soft-404-gate";

/** Plancher de mots des articles longs : en dessous, relecture humaine. */
export const PLANCHER_MOTS_RELECTURE = 850;

/**
 * Types dont le générateur exige lui-même ≥ 850 mots (`MIN_WORD_COUNT` des
 * générateurs blog et du guide pilier). Les actualités RSS, les FAQ, les
 * définitions et les pages de données sont plus courtes par nature : pas de
 * plancher pour eux.
 */
export const TYPES_PLANCHER_MOTS: ReadonlySet<string> = new Set([
  "blog_article",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "barometer_insight",
]);

/**
 * Types qui ne s'appuient pas sur la base de connaissances : les actualités
 * (une dépêche figée) et l'analyse de l'Observatoire (données chiffrées de
 * l'Observatoire, `kbEntryIds` vaut toujours []).
 */
export const TYPES_SANS_FAIT_DE_BASE: ReadonlySet<string> = new Set([
  "blog_from_rss",
  "barometer_insight",
]);

export type CodeBarriere =
  | "section-indisponible"
  | "h2-hors-plan"
  | "soft-404"
  | "aucun-fait-de-base"
  | "accroche-trop-proche"
  | "moins-de-850-mots";

export interface BarriereRelecture {
  readonly code: CodeBarriere;
  /** Libellé en français simple, repris dans le journal (`blockCauses`). */
  readonly libelle: string;
  /** Détail chiffré pour le journal. */
  readonly detail?: Record<string, unknown>;
}

export type SortiePourBarrieres = Pick<
  GeneratorOutput,
  "directAnswer" | "bodyHtml" | "faq" | "wordCount" | "kbEntryIds" | "plannedH2Count"
>;

export interface EntreeBarrieres {
  readonly contentType: string;
  readonly output: SortiePourBarrieres;
  /** Articles déjà publiés (slug → texte), tel que chargé par `loadPlagiarismCorpus`. */
  readonly corpus: ReadonlyMap<string, string>;
  /** Le job est ancré sur une ville (cas local), ce qui abaisse le seuil soft-404. */
  readonly ancreVille: boolean;
}

/** Nombre de `<h2>` ouvrants dans un HTML. */
export function compterH2(html: string): number {
  return (html.match(/<h2\b/gi) ?? []).length;
}

/** Liste les barrières franchies ; tableau vide = rien à signaler. */
export function evaluerBarrieresRelecture(entree: EntreeBarrieres): BarriereRelecture[] {
  const { contentType, output, corpus } = entree;
  const html = output.bodyHtml ?? "";
  const barrieres: BarriereRelecture[] = [];

  if (/section\s+indisponible/i.test(html)) {
    barrieres.push({
      code: "section-indisponible",
      libelle: "Section indisponible dans le texte (une partie n'a pas pu être rédigée)",
    });
  }

  // On ne regarde que le MANQUE de sections : la source et l'appel à l'action
  // injectés après la rédaction peuvent légitimement ajouter un <h2>.
  const prevus = output.plannedH2Count;
  if (typeof prevus === "number" && prevus > 0) {
    const obtenus = compterH2(html);
    if (obtenus < prevus) {
      barrieres.push({
        code: "h2-hors-plan",
        libelle: `Sections manquantes (${obtenus} titres h2 pour ${prevus} prévus au plan)`,
        detail: { h2_prevus: prevus, h2_obtenus: obtenus },
      });
    }
  }

  const soft404 = evaluateSoft404({
    wordCount: output.wordCount,
    hasFullLocalBusinessJsonLd: false,
    hasLocalCase: entree.ancreVille,
    faqCount: (output.faq ?? []).length,
  });
  if (soft404.isSoft404) {
    barrieres.push({
      code: "soft-404",
      libelle: `Texte trop court pour une page utile (${output.wordCount} mots, seuil ${soft404.threshold})`,
      detail: { mots: output.wordCount, seuil: soft404.threshold },
    });
  }

  // Décision Will « tout indexable » : ce plancher n'envoie qu'en RELECTURE.
  if (TYPES_PLANCHER_MOTS.has(contentType) && output.wordCount < PLANCHER_MOTS_RELECTURE) {
    barrieres.push({
      code: "moins-de-850-mots",
      libelle: `Moins de ${PLANCHER_MOTS_RELECTURE} mots (${output.wordCount}) pour un article long`,
      detail: { mots: output.wordCount, plancher: PLANCHER_MOTS_RELECTURE },
    });
  }

  // `kbEntryIds` absent = le générateur ne trace pas la base : on ne peut pas
  // juger, on ne bloque pas. Seul un tableau VIDE est « aucun fait de base ».
  if (
    !TYPES_SANS_FAIT_DE_BASE.has(contentType) &&
    Array.isArray(output.kbEntryIds) &&
    output.kbEntryIds.length === 0
  ) {
    barrieres.push({
      code: "aucun-fait-de-base",
      libelle: "Aucun fait de la base de connaissances derrière cet article",
    });
  }

  const accroche = verifierAccrocheTropProche(
    { directAnswer: output.directAnswer, bodyHtml: html },
    corpus,
  );
  if (accroche.bloque) {
    barrieres.push({
      code: "accroche-trop-proche",
      libelle: `Accroche trop proche d'un article déjà publié (${Math.round(accroche.similarite * 100)} %, /${accroche.slugProche ?? "?"})`,
      detail: {
        similarite: accroche.similarite,
        slug_proche: accroche.slugProche,
        source: accroche.source,
      },
    });
  }

  return barrieres;
}

// ─── Rejeu de la doctrine de surface à la publication ───────────────────────

function chaine(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Reconstruit la sortie pour le contrôle de surface à partir de
 * `ContentGenJob.outputJsonRaw` (JSON libre : chaque champ est vérifié).
 */
export function sortieDepuisJson(raw: Record<string, unknown>): SortiePourSurface {
  const faqBrute = Array.isArray(raw["faq"]) ? (raw["faq"] as unknown[]) : [];
  const faq = faqBrute.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const o = item as Record<string, unknown>;
    return [{ question: chaine(o["question"]), answer: chaine(o["answer"]) }];
  });
  const tags = Array.isArray(raw["tags"])
    ? (raw["tags"] as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  const expert = raw["expertQuote"];
  const texteExpert =
    typeof expert === "object" && expert !== null
      ? chaine((expert as Record<string, unknown>)["text"])
      : "";
  const pointCle = chaine(raw["keyTakeaway"]);

  return {
    title: chaine(raw["title"]),
    metaTitle: chaine(raw["metaTitle"]),
    metaDescription: chaine(raw["metaDescription"]),
    slug: chaine(raw["slug"]),
    directAnswer: chaine(raw["directAnswer"]),
    bodyHtml: chaine(raw["bodyHtml"]),
    bodyText: chaine(raw["bodyText"]),
    faq,
    ...(pointCle ? { keyTakeaway: pointCle } : {}),
    ...(texteExpert ? { expertQuote: { name: "", title: "", text: texteExpert } } : {}),
    tags,
  };
}

/**
 * Doctrine de surface rejouée sur le JSON persisté. Sert au worker de
 * publication, quel que soit le chemin (juge, relecture, actualités).
 */
export function controlerSurfacePublication(
  raw: Record<string, unknown>,
  opts: OptionsInterdits,
): InterditSurface[] {
  return detecterInterditsSurface(surfaceDepuisSortie(sortieDepuisJson(raw)), opts);
}

/** « code@champ, code@champ » : forme courte pour le journal et le message d'erreur. */
export function resumerViolations(violations: ReadonlyArray<InterditSurface>): string {
  return violations.map((v) => `${v.code}@${v.champ}`).join(", ");
}

// ─── Garde de fact-check avant publication ──────────────────────────────────

export type DecisionGardeFactCheck = "passer" | "non-verifie" | "quarantaine";

/**
 * Un score absent (`null`) veut dire « non vérifié », jamais « refusé » : le
 * fact-check tourne APRÈS la publication (décision Will 14/06/2026 : corriger en
 * place plutôt que dés-indexer). Seul un score réellement mesuré sous le seuil,
 * avant que l'article existe, met le job en quarantaine.
 */
export function decisionGardeFactCheck(args: {
  readonly actif: boolean;
  readonly articleExiste: boolean;
  readonly score: number | null | undefined;
  readonly seuil: number;
}): DecisionGardeFactCheck {
  if (!args.actif || args.articleExiste) return "passer";
  if (typeof args.score !== "number" || !Number.isFinite(args.score)) return "non-verifie";
  return args.score < args.seuil ? "quarantaine" : "passer";
}
