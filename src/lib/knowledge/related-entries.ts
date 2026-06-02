/**
 * Maillage KB → KB (cluster topique) — reader « entrée → entrées liées ».
 *
 * Levier d'autorité topique + anti dead-end : relie une entrée `/connaissances`
 * aux autres entrées du même cluster. Stratégie en TIERS (du signal le plus fort
 * au plus faible), tous filtrés par le prédicat anti-leak public (SSOT
 * `publicEntryFilter`) :
 *   1. **Relations éditoriales explicites** (`KnowledgeRelation`, kinds
 *      constructifs `related_to/extends/depends_on/cites`, dans les deux sens) ;
 *   2. **Tags partagés** (entrées partageant le plus de tags) ;
 *   3. **Même domaine** (repli récence) pour garantir un cluster non vide.
 *
 * Dégrade proprement : `[]` si l'entrée est inconnue/non-publique, ou au build
 * (stub Prisma `stub.invalid` → findFirst null → `[]`). Anti-doorway : on relie
 * des entrées DISTINCTES déjà publiées, on n'en fabrique aucune.
 *
 * NB : un 4ᵉ tier sémantique (embeddings pgvector `KnowledgeEmbedding`, op `<=>`)
 * serait le signal le plus fin mais impose du SQL brut + une gestion stub
 * dédiée → laissé en évolution future. Les 3 tiers ci-dessus sont index-backed
 * et suffisent à constituer le cluster.
 */

import { prisma } from "@/lib/prisma";
import { publicEntryFilter } from "./public-fetch";
import type { KbRelationKind } from "../../../prisma/generated/client";

const FR_LOCALE = "fr" as const;

/** Kinds de relation « constructifs » à surfacer (on exclut contradicts/replaces/supersedes). */
const CONSTRUCTIVE_KINDS: ReadonlyArray<KbRelationKind> = [
  "related_to",
  "extends",
  "depends_on",
  "cites",
];

export interface RelatedKbCard {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly type: string;
}

/**
 * Charge des cartes KB publiques (FR) pour une liste d'ids, en PRÉSERVANT
 * l'ordre de priorité fourni. Filtre anti-leak appliqué → un id non-public est
 * silencieusement écarté.
 */
async function loadCards(ids: ReadonlyArray<string>, now: Date): Promise<RelatedKbCard[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.knowledgeEntry.findMany({
    where: {
      ...publicEntryFilter(now),
      id: { in: [...ids] },
      translations: { some: { locale: FR_LOCALE } },
    },
    select: {
      id: true,
      type: true,
      translations: {
        where: { locale: FR_LOCALE },
        select: { slug: true, title: true, excerpt: true },
        take: 1,
      },
    },
  });
  const byId = new Map<string, RelatedKbCard>();
  for (const row of rows) {
    const t = row.translations[0];
    if (!t || !t.slug) continue;
    byId.set(row.id, { slug: t.slug, title: t.title, excerpt: t.excerpt, type: String(row.type) });
  }
  // Réordonne selon la priorité d'entrée (les findMany Prisma ne garantissent pas l'ordre).
  return ids.map((id) => byId.get(id)).filter((c): c is RelatedKbCard => Boolean(c));
}

/**
 * Renvoie jusqu'à `limit` entrées KB liées à `slugFr` (cluster topique).
 * `[]` si l'entrée est inconnue/non-publique ou si aucun voisin n'existe.
 */
export async function findRelatedKbEntries(
  slugFr: string,
  opts: { limit?: number } = {},
): Promise<RelatedKbCard[]> {
  const limit = opts.limit ?? 4;
  const now = new Date();

  try {
    // Résout l'entrée courante (et son domaine) via le filtre public strict.
    const current = await prisma.knowledgeTranslation.findFirst({
      where: { locale: FR_LOCALE, slug: slugFr, entry: publicEntryFilter(now) },
      select: { entryId: true, entry: { select: { domain: true } } },
    });
    if (!current) return [];
    const currentId = current.entryId;
    const seen = new Set<string>([currentId]);

    // ---- Tier 1 : relations éditoriales explicites (deux sens) ----
    const rels = await prisma.knowledgeRelation.findMany({
      where: {
        kind: { in: [...CONSTRUCTIVE_KINDS] },
        OR: [{ fromEntryId: currentId }, { toEntryId: currentId }],
      },
      select: { fromEntryId: true, toEntryId: true },
    });
    const tier1Ids: string[] = [];
    for (const r of rels) {
      const other = r.fromEntryId === currentId ? r.toEntryId : r.fromEntryId;
      if (!seen.has(other)) {
        seen.add(other);
        tier1Ids.push(other);
      }
    }

    // ---- Tier 2 : tags partagés (ranking par nombre de tags en commun) ----
    const tier2Ids: string[] = [];
    const myTags = await prisma.knowledgeTagOnEntry.findMany({
      where: { entryId: currentId },
      select: { tagId: true },
    });
    const tagIds = myTags.map((t) => t.tagId);
    if (tagIds.length > 0) {
      const shares = await prisma.knowledgeTagOnEntry.findMany({
        where: {
          tagId: { in: tagIds },
          entryId: { notIn: [...seen] },
          entry: publicEntryFilter(now),
        },
        select: { entryId: true },
        take: 400, // garde-fou perf : suffisant pour un ranking d'overlap fiable
      });
      const overlap = new Map<string, number>();
      for (const s of shares) overlap.set(s.entryId, (overlap.get(s.entryId) ?? 0) + 1);
      const ranked = [...overlap.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
      for (const id of ranked) {
        if (!seen.has(id)) {
          seen.add(id);
          tier2Ids.push(id);
        }
      }
    }

    // Charge tier 1 + 2 (validés public + FR, ordre préservé).
    let cards = await loadCards([...tier1Ids, ...tier2Ids], now);

    // ---- Tier 3 : repli même domaine (récence) pour compléter le cluster ----
    if (cards.length < limit) {
      const exclude = new Set<string>(seen);
      const fill = await prisma.knowledgeEntry.findMany({
        where: {
          ...publicEntryFilter(now),
          domain: current.entry.domain,
          id: { notIn: [...exclude] },
          translations: { some: { locale: FR_LOCALE } },
        },
        orderBy: [{ pinned: "desc" }, { featured: "desc" }, { publishedAt: "desc" }],
        take: limit - cards.length,
        select: {
          type: true,
          translations: {
            where: { locale: FR_LOCALE },
            select: { slug: true, title: true, excerpt: true },
            take: 1,
          },
        },
      });
      const fillCards = fill
        .map((e): RelatedKbCard | null => {
          const t = e.translations[0];
          if (!t || !t.slug) return null;
          return { slug: t.slug, title: t.title, excerpt: t.excerpt, type: String(e.type) };
        })
        .filter((c): c is RelatedKbCard => c !== null);
      cards = [...cards, ...fillCards];
    }

    return cards.slice(0, limit);
  } catch {
    // Table absente bootstrap / DB down → fail-soft (pas de section vide indexée).
    return [];
  }
}
