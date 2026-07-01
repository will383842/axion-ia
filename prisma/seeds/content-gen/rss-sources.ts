/**
 * Seeder — RssSource (Sprint S+5 P2-3, 2026-05-20).
 *
 * Migre les sources RSS V1 stockées dans `ContentGenConfig.key="rss_sources"`
 * (JSON inline) vers la table dédiée `RssSource`.
 *
 * Idempotent : upsert par `url` (unique). Run multiple fois OK.
 *
 * Usage standalone (rare) :
 *   pnpm tsx prisma/seeds/content-gen/rss-sources.ts
 *
 * Usage normal (intégré au seed orchestrateur) :
 *   pnpm content-gen:seed
 *
 * Comportement runtime :
 *   1. Tente de lire `ContentGenConfig.key="rss_sources"`.
 *   2. Si JSON présent → upsert chaque entrée dans RssSource.
 *   3. Si vide (premier déploiement) → no-op, log info. L'admin pourra ajouter
 *      via l'UI /content-gen/rss (Server Action wired sur RssSource table dans
 *      un sprint ultérieur — V1.5 worker lit déjà depuis RssSource avec
 *      fallback legacy le temps de la migration UI).
 *
 * Verticale auto-détection : si le `name` legacy contient un mot-clé
 * verticale connu (audit, formation, implementation, coaching/un-a-un),
 * on assigne le slug correspondant. Sinon `null` (transverse).
 *
 * TODO Sprint S+6 :
 *   - Wire Server Actions admin `/content-gen/rss` sur RssSource au lieu de
 *     ContentGenConfig (cf. `src/server/actions/content-gen/rss.ts`).
 *   - Retirer le fallback ContentGenConfig dans le worker.
 */

import type { PrismaClient } from "../../generated/client";

interface LegacyRssSource {
  readonly url: string;
  readonly name: string;
  readonly tags?: ReadonlyArray<string>;
  readonly pollIntervalMin?: number;
  readonly autoPublish?: boolean;
  readonly enabled?: boolean;
}

const _VERTICALES = ["interventions", "audit", "implementations", "un_a_un"] as const;
type Verticale = (typeof _VERTICALES)[number];

function detectVerticale(source: LegacyRssSource): Verticale | null {
  const hay = `${source.name} ${(source.tags ?? []).join(" ")}`.toLowerCase();
  if (/\bun[-\s_]?a[-\s_]?un\b|\bcoaching\b|\b1[\s-]?to[\s-]?1\b/.test(hay)) return "un_a_un";
  if (/\baudit\b/.test(hay)) return "audit";
  if (/\bimpl[ée]?ment/.test(hay)) return "implementations";
  if (/\bformation\b|\bintervention\b/.test(hay)) return "interventions";
  return null;
}

/**
 * Sources RSS par défaut (2026-07-01) — veille IA anglo-saxonne à retraiter en
 * pont éditorial FR (résumé + analyse business + parallèle PME françaises). Ces
 * 4 flux (validés RSS 2.0) constituent le socle « Actualités IA ». Idempotent :
 * upsert par `url`. `language: "en"` = langue SOURCE (l'article généré reste FR).
 * `autoPublish: false` sur la source : la publication auto des news est pilotée
 * GLOBALEMENT par la policy `newsAutoPublish` (page admin Actualités / Lancer),
 * pas par flux — un seul interrupteur Google News.
 */
const DEFAULT_RSS_SOURCES: ReadonlyArray<{
  url: string;
  name: string;
  tags: ReadonlyArray<string>;
  language: string;
}> = [
  {
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    name: "MIT Technology Review — Artificial Intelligence",
    tags: ["ia", "strategie", "transformation", "entreprise"],
    language: "en",
  },
  {
    url: "https://www.kdnuggets.com/feed",
    name: "KDnuggets",
    tags: ["ia", "machine-learning", "data-science", "business"],
    language: "en",
  },
  {
    url: "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml",
    name: "ScienceDaily — Artificial Intelligence",
    tags: ["ia", "recherche", "applications"],
    language: "en",
  },
  {
    url: "https://openai.com/news/rss.xml",
    name: "OpenAI — News",
    tags: ["ia", "llm", "produits", "adoption"],
    language: "en",
  },
];

/**
 * Upsert des sources par défaut. Toujours exécuté (indépendant de la migration
 * legacy). `enabled: true` pour qu'elles soient pollées dès le prochain tick ;
 * le volume reste borné par `policies.rssMaxPerDay`.
 */
async function seedDefaultRssSources(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const src of DEFAULT_RSS_SOURCES) {
    await prisma.rssSource.upsert({
      where: { url: src.url },
      create: {
        url: src.url,
        name: src.name,
        enabled: true,
        verticale: null,
        tags: src.tags as never,
        pollIntervalMin: 60,
        autoPublish: false,
        language: src.language,
      },
      // Ne PAS écraser `enabled`/`autoPublish` à l'update : Will peut les avoir
      // ajustés en console. On rafraîchit seulement les métadonnées éditoriales.
      update: {
        name: src.name,
        tags: src.tags as never,
        language: src.language,
      },
    });
    count += 1;
  }
  console.log(`[rss-sources seed] upserted ${count} default AI-watch sources.`);
  return count;
}

export async function seedRssSources(prisma: PrismaClient): Promise<number> {
  // Socle par défaut (veille IA anglo-saxonne) — toujours upserté, idempotent.
  const defaultCount = await seedDefaultRssSources(prisma);

  // Lecture legacy ContentGenConfig (clé V1).
  const legacyConfig = await prisma.contentGenConfig
    .findUnique({ where: { key: "rss_sources" } })
    .catch(() => null);

  if (!legacyConfig?.value) {
    console.log(
      '[rss-sources seed] no legacy ContentGenConfig.key="rss_sources" found — default sources only.',
    );
    return defaultCount;
  }

  const raw = legacyConfig.value as unknown;
  if (!Array.isArray(raw) || raw.length === 0) {
    console.log("[rss-sources seed] legacy rss_sources empty — default sources only.");
    return defaultCount;
  }

  let count = 0;
  for (const item of raw as ReadonlyArray<LegacyRssSource>) {
    if (!item || typeof item.url !== "string" || typeof item.name !== "string") continue;
    const verticale = detectVerticale(item);
    await prisma.rssSource.upsert({
      where: { url: item.url },
      create: {
        url: item.url,
        name: item.name,
        enabled: item.enabled ?? true,
        verticale,
        tags: (item.tags ?? []) as never,
        pollIntervalMin: item.pollIntervalMin ?? 60,
        autoPublish: item.autoPublish ?? false,
        language: "fr",
      },
      update: {
        name: item.name,
        enabled: item.enabled ?? true,
        verticale,
        tags: (item.tags ?? []) as never,
        pollIntervalMin: item.pollIntervalMin ?? 60,
        autoPublish: item.autoPublish ?? false,
      },
    });
    count += 1;
  }

  console.log(`[rss-sources seed] migrated ${count} legacy sources → RssSource table.`);
  return defaultCount + count;
}
