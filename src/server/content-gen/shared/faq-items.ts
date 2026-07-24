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
 *
 * ⚠️ AUDIT 2026-07-21 — résolution des tokens `{{price:…}}` AJOUTÉE ici.
 * Le corps d'article était déjà résolu au rendu (`blog/[slug]/page.tsx` appelle
 * `resolvePriceTokens` sur `dbBody.html`), mais la FAQ vient d'un champ SÉPARÉ
 * (`Article.faqJson`) qui ne passait par aucun résolveur. Résultat mesuré en
 * prod : 25 articles publiés affichaient `{{price:audit-strategique-pme|range}}`
 * en clair, à la fois dans le HTML visible ET dans le JSON-LD `FAQPage` envoyé
 * à Google.
 *
 * On résout ICI plutôt que d'écrire les prix en base : `parseFaqItems` est le
 * point de passage unique (blog + guides), et surtout les prix restent
 * DYNAMIQUES — les figer en base créerait une dérive silencieuse au prochain
 * changement de grille tarifaire.
 */

import { collapsePriceProseDuplicates, resolvePriceTokens } from "@/content/pricing-tokens";

/** Résout les tokens puis recolle la prose (« commence à À partir de … »). */
const renderPrice = (s: string, locale: "fr" | "en"): string =>
  collapsePriceProseDuplicates(resolvePriceTokens(s, locale));

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

// Anti-placeholder : rejette les Q/R bouche-trou produites par un LLM dégradé
// (audit perfection 2026-06-22). Volontairement conservateur (faux positifs ~0).
const FAQ_PLACEHOLDER_RE =
  /\b(todo|à remplir|a remplir|lorem ipsum|placeholder|à compléter|a completer)\b|\{\{|\}\}/i;

/**
 * Validation STRICTE d'un item FAQ — utilisée par le gate qualité au publish
 * (P0 perfection 2026) pour refuser un article dont la FAQ est creuse. Le rendu
 * (parseFaqItems sans `strict`) reste lenient pour ne pas masquer rétroactivement
 * les FAQ d'articles déjà publiés.
 */
export function validateFaqItem(
  question: string,
  answer: string,
): { ok: boolean; reason?: string } {
  const q = question.trim();
  const a = answer.trim();
  if (q.length < 20) return { ok: false, reason: "question < 20 caractères" };
  if (a.length < 60) return { ok: false, reason: "réponse < 60 caractères" };
  if (FAQ_PLACEHOLDER_RE.test(q) || FAQ_PLACEHOLDER_RE.test(a)) {
    return { ok: false, reason: "placeholder détecté" };
  }
  return { ok: true };
}

export interface ParseFaqOptions {
  /** Applique validateFaqItem + anti-doublon. Réservé au gate publish (P0). */
  readonly strict?: boolean;
  /** Locale de résolution des tokens `{{price:…}}`. Défaut `"fr"`. */
  readonly locale?: "fr" | "en";
}

export function parseFaqItems(raw: unknown, opts: ParseFaqOptions = {}): ReadonlyArray<FaqItem> {
  const locale = opts.locale ?? "fr";
  // Tolère les générateurs qui enveloppent la FAQ dans un objet audit-trail :
  // `guide-pilier.ts` persiste `faqJson: { outline, sectionFailures, faq: [...] }`
  // (un OBJET), donc sans ce déballage parseFaqItems retournait toujours `[]`
  // pour /guides → FAQPage jamais émis (bug confirmé audit 2026-06-22). Les
  // autres générateurs persistent déjà un tableau plat → inchangés.
  let list: unknown = raw;
  if (list && typeof list === "object" && !Array.isArray(list)) {
    const inner = (list as Record<string, unknown>).faq;
    if (Array.isArray(inner)) list = inner;
  }
  if (!Array.isArray(list)) return [];
  const out: FaqItem[] = [];
  const seenAnswers = new Set<string>();
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const q = typeof o.question === "string" ? o.question : typeof o.q === "string" ? o.q : null;
    const a = typeof o.answer === "string" ? o.answer : typeof o.a === "string" ? o.a : null;
    if (q && a && q.trim().length > 0 && a.trim().length > 0) {
      // Résolution AVANT la validation stricte : sinon un token légitime mais
      // non encore résolu ferait échouer `FAQ_PLACEHOLDER_RE` (qui rejette
      // `{{`/`}}`) et supprimerait silencieusement une FAQ parfaitement valide.
      const question = renderPrice(q.trim(), locale);
      const answer = renderPrice(a.trim(), locale);
      if (opts.strict) {
        if (!validateFaqItem(question, answer).ok) continue;
        // Anti-doublon : deux réponses identiques (normalisées) = FAQ gonflée.
        const key = answer.toLowerCase().replace(/\s+/g, " ");
        if (seenAnswers.has(key)) continue;
        seenAnswers.add(key);
      }
      out.push({ question, answer });
    }
  }
  return out;
}
