/**
 * Parseur partagé de `Article.faqJson` (chantier templates 2026-06-21).
 *
 * `faqJson` est un Json libre écrit par les generators ; la forme varie
 * (`{ question, answer }` ou `{ q, a }`). Ce parseur défensif normalise en
 * `{ question, answer }` et ignore tout item incomplet. Retourne `[]` si la
 * donnée est absente/malformée (zéro régression : pas de FAQ → l'accordéon
 * `<ArticleFaq>` ne se rend pas).
 *
 * Centralisé ici pour être réutilisé par les loaders blog ET guides (et tout
 * futur loader d'article) sans dupliquer la logique.
 */

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export function parseFaqItems(raw: unknown): ReadonlyArray<FaqItem> {
  if (!Array.isArray(raw)) return [];
  const out: FaqItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const q = typeof o.question === "string" ? o.question : typeof o.q === "string" ? o.q : null;
    const a = typeof o.answer === "string" ? o.answer : typeof o.a === "string" ? o.a : null;
    if (q && a && q.trim().length > 0 && a.trim().length > 0) {
      out.push({ question: q.trim(), answer: a.trim() });
    }
  }
  return out;
}
