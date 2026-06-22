/**
 * Liens internes PROFONDS article→article (refonte 2026-06-22).
 *
 * Complète `internal-link-catalog.ts` (qui ne pointe que vers ~10 HUBS statiques)
 * en injectant 1-2 liens vers d'AUTRES articles tier-1 publiés, sur une phrase
 * de leur titre réellement présente dans le corps → maillage profond + autorité
 * thématique (vs uniquement des liens vers /audit, /blog…).
 *
 * Best-effort, async (requête DB), à appeler dans le worker APRÈS la génération
 * (hors transaction), sur le body persisté. Conservateur : on ne lie QUE sur une
 * correspondance franche (bigramme de mots de contenu du titre) hors balise et
 * hors lien existant → jamais de lien forcé/incohérent. Aucun lien si rien ne
 * matche. Stub-safe au build (DATABASE_URL=stub.invalid → [] sans call DB).
 */

import { prisma } from "@/lib/prisma";

export interface InjectDeepLinksInput {
  readonly currentSlug: string;
  readonly locale: "fr" | "en";
  readonly maxLinks?: number;
}

const STOPWORDS = new Set([
  "les",
  "des",
  "une",
  "pour",
  "avec",
  "dans",
  "sur",
  "par",
  "aux",
  "vos",
  "nos",
  "the",
  "and",
  "with",
  "comment",
  "pourquoi",
]);

/** Bigrammes de mots de contenu adjacents du titre (préserve le phrasé réel). */
export function titlePhrases(title: string): string[] {
  const words = title
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter(Boolean);
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i] ?? "";
    const b = words[i + 1] ?? "";
    if (
      a.length > 3 &&
      b.length > 3 &&
      !STOPWORDS.has(a.toLowerCase()) &&
      !STOPWORDS.has(b.toLowerCase())
    ) {
      phrases.push(`${a} ${b}`);
    }
  }
  return phrases;
}

/** Injecte la phrase comme lien interne si elle apparaît dans le body (hors balise/lien). */
export function linkPhraseInBody(bodyHtml: string, phrase: string, href: string): string | null {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Même garde que injectInternalLinks : pas dans un href, pas dans une balise.
  const re = new RegExp(`(?<!href=[^>]{0,200})\\b(${esc})\\b(?![^<]*>)`, "i");
  if (!re.test(bodyHtml)) return null;
  return bodyHtml.replace(re, `<a href="${href}">$1</a>`);
}

export async function injectDeepArticleLinks(
  bodyHtml: string,
  input: InjectDeepLinksInput,
): Promise<string> {
  if (typeof bodyHtml !== "string" || bodyHtml.length === 0) return bodyHtml;
  const maxLinks = Math.max(1, Math.min(input.maxLinks ?? 2, 3));

  const rows = await prisma.articleTranslation
    .findMany({
      where: {
        locale: input.locale,
        slug: { not: input.currentSlug },
        article: { status: "published", indexationTier: "tier_1_indexable", isNews: false },
      },
      select: { slug: true, title: true },
      orderBy: { article: { publishedAt: "desc" } },
      take: 20,
    })
    .catch(() => []);
  if (rows.length === 0) return bodyHtml;

  let result = bodyHtml;
  let injected = 0;
  for (const row of rows) {
    if (injected >= maxLinks) break;
    const href = `/blog/${row.slug}`;
    if (result.includes(`href="${href}"`)) continue;
    for (const phrase of titlePhrases(row.title)) {
      const next = linkPhraseInBody(result, phrase, href);
      if (next) {
        result = next;
        injected++;
        break;
      }
    }
  }
  return result;
}
