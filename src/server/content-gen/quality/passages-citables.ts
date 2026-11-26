/**
 * Passages citables (GEO) : fonctions PURES, sans dépendance serveur, partagées par l'éditeur
 * SEO (`equipe/edition-seo.ts`) et la note SEO (`quality/seo-score.ts`).
 */

import { normaliserTitre } from "./outline-validator";

export const PASSAGE_MOTS_MIN = 40;
export const PASSAGE_MOTS_MAX = 80;
export const PASSAGES_CITABLES_MIN = 3;

// ── Utilitaires texte ───────────────────────────────────────────────────────

const ENTITES_HTML: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function texteSansBalises(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITES_HTML[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export const compterMots = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function extraireBlocs(html: string, balise: "p" | "h1" | "h2"): string[] {
  const re = new RegExp(`<${balise}(?:\\s[^>]*)?>([\\s\\S]*?)</${balise}>`, "gi");
  return [...html.matchAll(re)].map((m) => texteSansBalises(m[1] ?? "")).filter(Boolean);
}

// ── Passages citables ───────────────────────────────────────────────────────

/** Débuts de paragraphe qui dépendent de ce qui précède : le passage n'est alors pas autonome. */
const RENVOIS_EN_TETE: readonly string[] = [
  "comme vu plus haut",
  "comme vu precedemment",
  "comme indique",
  "comme mentionne",
  "comme evoque",
  "comme explique",
  "comme precise",
  "comme dit",
  "comme nous l avons vu",
  "ci dessus",
  "plus haut",
  "precedemment",
  "ceci",
  "cela",
  "ce dernier",
  "cette derniere",
  "ces derniers",
  "ces dernieres",
  "celui ci",
  "celle ci",
  "ceux ci",
  "celles ci",
  "dans ce cas",
  "pour cela",
  "pour ceci",
  "de ce fait",
  "en ce sens",
];

export function commenceParUnRenvoi(passage: string): boolean {
  const debut = ` ${normaliserTitre(passage)} `;
  return RENVOIS_EN_TETE.some((r) => debut.startsWith(` ${r} `));
}

export interface PassagesCitables {
  readonly citables: ReadonlyArray<string>;
  readonly total: number;
}

/** Passage citable = paragraphe autonome de 40 à 80 mots, sans renvoi en tête. */
export function detecterPassagesCitables(html: string): PassagesCitables {
  const paragraphes = extraireBlocs(html, "p");
  const citables = paragraphes.filter((p) => {
    const n = compterMots(p);
    return n >= PASSAGE_MOTS_MIN && n <= PASSAGE_MOTS_MAX && !commenceParUnRenvoi(p);
  });
  return { citables, total: paragraphes.length };
}
