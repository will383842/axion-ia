/**
 * Persistance des citations structurées (chantier 2026-06-22).
 *
 * Pont entre le système de liens d'autorité RÉEL (catalogue `ALL_EXTERNAL_LINKS`,
 * injecté dans le corps des articles générés) et les tables structurées
 * `ExternalReference` + `ContentCitation`, lues par :
 *   - le bloc public « Sources & méthodologie » (`ArticleSources`)
 *   - le JSON-LD `isBasedOn` (`blog/loader.ts`, `guides/loader.ts`, `actualites`)
 *
 * Jusqu'ici ces deux tables n'avaient AUCUN writer → toujours vides → le bloc
 * « Sources » ne s'affichait jamais. On les alimente au publish, à partir des
 * liens RÉELLEMENT présents dans le body (issus de `detectHallucinations().valid`,
 * donc déjà filtrés contre le catalogue). Garanties :
 *   - zéro citation inventée : seul le catalogue curé (~2 400 liens vérifiés HEAD)
 *     est éligible ; un lien halluciné par le LLM n'arrive jamais ici.
 *   - parité affichage ↔ contenu : on ne liste que les sources effectivement citées.
 *
 * Best-effort : appelé depuis le bloc try non-bloquant du `content-publish-worker`,
 * APRÈS l'insert de l'Article. Une erreur ici ne bloque jamais la publication.
 */

import { prisma } from "@/lib/prisma";
import { ALL_EXTERNAL_LINKS } from "@/data/external-links/master";
import type { ExternalLink } from "@/data/external-links/types";
import { extractDomain } from "./trust-tier";
import type { Locale, TrustTier } from "../../../../prisma/generated/client";

/**
 * Mappe l'autorité curée du catalogue (1-5 + catégorie) vers le `TrustTier`
 * Prisma de `ExternalReference`. Les domaines publics FR/EU sont `official` quelle
 * que soit leur note ; au-dessus de 4 → `high` ; 3 → `standard` ; sinon `low`.
 */
export function mapAuthorityToTrustTier(link: ExternalLink): TrustTier {
  if (link.category === "gov_fr" || link.category === "gov_eu") return "official";
  if (link.authority >= 4) return "high";
  if (link.authority >= 3) return "standard";
  return "low";
}

function toDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Extrait le texte d'ancre (texte visible) du premier `<a href="url">…</a>`
 * trouvé dans le HTML du body. Retourne `null` si le lien n'est pas présent
 * (ne devrait pas arriver : on n'appelle que sur des IDs détectés dans le body).
 */
export function extractAnchorText(bodyHtml: string, url: string): string | null {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<a\\b[^>]*href=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/a>`, "i");
  const m = bodyHtml.match(re);
  if (!m || !m[1]) return null;
  const text = m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : null;
}

export interface PersistCitationsArgs {
  /** Article.id (UUID) fraîchement inséré. */
  readonly articleId: string;
  /**
   * ContentGenJob.id à l'origine de l'article. Optionnel : le backfill d'articles
   * historiques peut ne pas avoir de job lié (`Article.generatedByJobId` null).
   */
  readonly jobId?: string | null;
  /** IDs de liens du catalogue réellement présents dans le body (detection.valid). */
  readonly linkIds: readonly string[];
  /** HTML du body publié — sert à récupérer l'ancre réelle de chaque lien. */
  readonly bodyHtml: string;
}

/**
 * Persiste les `ContentCitation` (+ upsert des `ExternalReference`) d'un article.
 * Idempotent : repart d'une table propre pour cet article (re-publication safe).
 * Retourne le nombre de citations effectivement écrites.
 */
export async function persistArticleCitations(
  args: PersistCitationsArgs,
): Promise<{ persisted: number }> {
  const { articleId, jobId, linkIds, bodyHtml } = args;
  const uniqueIds = Array.from(new Set(linkIds.filter((id) => id.length > 0)));
  if (uniqueIds.length === 0) return { persisted: 0 };

  // Idempotence : un article fraîchement inséré n'a pas encore de citations, mais
  // en cas de re-publication d'un même articleId on repart d'une base propre.
  await prisma.contentCitation.deleteMany({ where: { articleId } });

  let persisted = 0;
  for (const id of uniqueIds) {
    const link = ALL_EXTERNAL_LINKS.find((l) => l.id === id);
    if (!link) continue;
    const domain = extractDomain(link.url);
    if (!domain) continue;

    const trustTier = mapAuthorityToTrustTier(link);
    const language: Locale = link.language === "en" ? "en" : "fr";
    const lastVerifiedAt = toDate(link.verifiedAt) ?? toDate(link.lastCheckedAt);

    const ref = await prisma.externalReference.upsert({
      where: { url: link.url },
      create: {
        url: link.url,
        title: link.title,
        publisher: link.organization,
        publisherDomain: domain,
        trustTier,
        language,
        isAlive: true,
        ...(lastVerifiedAt ? { lastVerifiedAt } : {}),
        citationCount: 1,
      },
      update: {
        title: link.title,
        publisher: link.organization,
        publisherDomain: domain,
        trustTier,
        language,
        isAlive: true,
        ...(lastVerifiedAt ? { lastVerifiedAt } : {}),
        citationCount: { increment: 1 },
      },
      select: { id: true },
    });

    const anchor = (extractAnchorText(bodyHtml, link.url) ?? link.title).trim();
    await prisma.contentCitation.create({
      data: {
        articleId,
        ...(jobId ? { jobId } : {}),
        externalReferenceId: ref.id,
        anchorText: anchor.slice(0, 300),
        citationContext: anchor.slice(0, 500),
      },
    });
    persisted += 1;
  }

  return { persisted };
}
