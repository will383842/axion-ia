/**
 * Backfill des citations structurées sur les articles DÉJÀ publiés — logique partagée.
 *
 * Source de vérité unique appelée par :
 *   • le script CLI `src/scripts/backfill-article-citations.ts` (local / one-shot) ;
 *   • l'action serveur admin `citations-backfill.ts` (bouton console → tourne DANS
 *     le conteneur prod, accès Prisma direct, AUCUNE exposition réseau de la DB).
 *
 * Contexte (chantier 2026-06-22, cf. `persist-citations.ts`) : les tables
 * `external_references` + `content_citations` n'ont eu un writer qu'à partir du
 * publish-worker (PR 134) → les articles publiés AVANT n'affichent pas le bloc public
 * « Sources & méthodologie ». Ce module rejoue la même logique sur l'historique :
 *   - lit le body HTML FR de chaque article (`ArticleTranslation.body`),
 *   - `detectHallucinations()` ne retient que les URLs présentes dans le catalogue
 *     curé `ALL_EXTERNAL_LINKS` (les hallucinations sont reportées, jamais persistées),
 *   - `persistArticleCitations()` upsert ExternalReference + (re)crée ContentCitation.
 *
 * Pagination par CURSEUR (keyset, `ArticleTranslation.id` asc) plutôt qu'un filtre
 * « sans citation » : un article sans aucun lien du catalogue n'obtiendra JAMAIS de
 * citation, donc un filtre le re-sélectionnerait à l'infini. Le curseur garantit que
 * chaque article est visité exactement une fois par passe complète.
 *
 * Idempotent : `persistArticleCitations` fait un `deleteMany` par articleId avant
 * ré-écriture ; `onlyMissing` (défaut) saute en plus les articles déjà cités pour ne
 * pas regonfler `ExternalReference.citationCount` lors d'une relance complète.
 */

import { prisma } from "@/lib/prisma";
import { detectHallucinations } from "@/data/external-links/helpers";
import { persistArticleCitations } from "@/server/content-gen/links/persist-citations";

export interface BackfillCitationsOptions {
  /** true = simulation, aucune écriture en base. */
  dryRun?: boolean;
  /** Plafond d'articles scannés sur cet appel (batch). Défaut 50. */
  limit?: number;
  /** `ArticleTranslation.id` après lequel reprendre (keyset). Omis = depuis le début. */
  cursor?: string | null;
  /**
   * true (défaut) = saute les articles dont l'Article a déjà ≥1 ContentCitation
   * (évite de regonfler les compteurs au re-run). false = retraite tout (idempotent
   * via le deleteMany interne de persistArticleCitations).
   */
  onlyMissing?: boolean;
  /** Callback de progression ligne par ligne (logs CLI). */
  onItem?: (line: string) => void;
}

export interface BackfillCitationItem {
  slug: string;
  action: "persisted" | "skip" | "already";
  /** Nombre de citations persistées (ou détectées en dry-run) pour cet article. */
  citations?: number;
  /** Nombre d'URLs hors-catalogue trouvées dans le body (non persistées). */
  hallucinated?: number;
}

export interface BackfillCitationsResult {
  /** Articles scannés sur cet appel (taille du lot effectif). */
  total: number;
  /** Articles ayant reçu ≥1 citation (persistée, ou détectée en dry-run). */
  updated: number;
  /** Articles sans lien éligible OU déjà cités (onlyMissing). */
  skipped: number;
  /** Total de citations persistées (ou détectées en dry-run) sur ce lot. */
  totalCitations: number;
  /** URLs hors-catalogue distinctes vues sur ce lot (jamais persistées). */
  hallucinatedUrls: string[];
  items: BackfillCitationItem[];
  /** `ArticleTranslation.id` à passer au prochain appel, ou null si terminé. */
  nextCursor: string | null;
}

/**
 * Compte les `ArticleTranslation` FR restant à scanner après `cursor` (ou le total
 * si `cursor` omis). Sert au bouton admin pour afficher « N articles » + « reste ».
 */
export async function countFrArticleTranslations(cursor?: string | null): Promise<number> {
  return prisma.articleTranslation.count({
    where: { locale: "fr", ...(cursor ? { id: { gt: cursor } } : {}) },
  });
}

export async function backfillCitations(
  opts: BackfillCitationsOptions = {},
): Promise<BackfillCitationsResult> {
  const { dryRun = false, limit = 50, cursor = null, onlyMissing = true, onItem } = opts;

  const page = await prisma.articleTranslation.findMany({
    where: { locale: "fr", ...(cursor ? { id: { gt: cursor } } : {}) },
    select: {
      id: true,
      articleId: true,
      slug: true,
      body: true,
      article: { select: { generatedByJobId: true } },
    },
    orderBy: { id: "asc" },
    take: limit,
  });

  // onlyMissing : un seul round-trip pour savoir quels articles ont déjà des citations.
  let alreadyCited = new Set<string>();
  if (onlyMissing && page.length > 0) {
    const existing = await prisma.contentCitation.findMany({
      where: { articleId: { in: page.map((p) => p.articleId) } },
      select: { articleId: true },
      distinct: ["articleId"],
    });
    alreadyCited = new Set(
      existing.map((e) => e.articleId).filter((id): id is string => Boolean(id)),
    );
  }

  let updated = 0;
  let skipped = 0;
  let totalCitations = 0;
  const items: BackfillCitationItem[] = [];
  const hallucinated = new Set<string>();

  for (const row of page) {
    if (onlyMissing && alreadyCited.has(row.articleId)) {
      skipped += 1;
      items.push({ slug: row.slug, action: "already" });
      continue;
    }

    const detection = detectHallucinations(row.body);
    for (const u of detection.hallucinated) hallucinated.add(u);

    if (detection.valid.length === 0) {
      skipped += 1;
      items.push({ slug: row.slug, action: "skip", hallucinated: detection.hallucinated.length });
      continue;
    }

    if (dryRun) {
      updated += 1;
      totalCitations += detection.valid.length;
      items.push({
        slug: row.slug,
        action: "persisted",
        citations: detection.valid.length,
        hallucinated: detection.hallucinated.length,
      });
      onItem?.(`[dry] ${row.slug} → ${detection.valid.length} citation(s)`);
      continue;
    }

    const res = await persistArticleCitations({
      articleId: row.articleId,
      jobId: row.article?.generatedByJobId ?? null,
      linkIds: detection.valid,
      bodyHtml: row.body,
    });
    if (res.persisted > 0) {
      updated += 1;
      totalCitations += res.persisted;
      items.push({ slug: row.slug, action: "persisted", citations: res.persisted });
    } else {
      skipped += 1;
      items.push({ slug: row.slug, action: "skip" });
    }
    onItem?.(`${row.slug} → ${res.persisted} citation(s)`);
  }

  // Page incomplète = on a atteint la fin ⇒ plus de curseur.
  const nextCursor = page.length < limit ? null : (page[page.length - 1]?.id ?? null);

  return {
    total: page.length,
    updated,
    skipped,
    totalCitations,
    hallucinatedUrls: [...hallucinated],
    items,
    nextCursor,
  };
}
