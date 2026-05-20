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

export async function seedRssSources(prisma: PrismaClient): Promise<number> {
  // Lecture legacy ContentGenConfig (clé V1).
  const legacyConfig = await prisma.contentGenConfig
    .findUnique({ where: { key: "rss_sources" } })
    .catch(() => null);

  if (!legacyConfig?.value) {
    console.log(
      '[rss-sources seed] no legacy ContentGenConfig.key="rss_sources" found — skipping (table will be populated via admin UI).',
    );
    // TODO : si Will fournit une liste de seed minimal (3-5 feeds sectoriels),
    // l'inscrire ici en upsert. V1 = seeder vide intentionnel.
    return 0;
  }

  const raw = legacyConfig.value as unknown;
  if (!Array.isArray(raw) || raw.length === 0) {
    console.log("[rss-sources seed] legacy rss_sources empty — nothing to migrate.");
    return 0;
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
  return count;
}
