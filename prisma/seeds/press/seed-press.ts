/**
 * Seed de la Salle de presse — migre les fixtures statiques `src/content/press.ts`
 * (3 communiqués + 6 assets de kit média) dans les tables DB, pour que Will puisse
 * ensuite les ÉDITER depuis la console admin.
 *
 * Idempotent :
 *  - communiqués : skip si une traduction [fr, slug] existe déjà ;
 *  - assets média : skip global si la table contient déjà des entrées.
 *
 * Les assets sont seedés SANS fichier (storagePath=null) — ce sont des
 * placeholders ; Will uploade le vrai logo / la charte depuis l'admin.
 *
 * Usage : `pnpm exec tsx prisma/seeds/press/run-seed-press.ts`
 *   (avec DATABASE_URL pointant vers la base cible).
 */

import type { PrismaClient, PressMediaKind } from "../../generated/client";
import { PRESS_RELEASES, PRESS_KIT_ASSETS } from "../../../src/content/press";

/** Mappe le `kind` des fixtures (hyphen) vers l'enum Prisma (underscore). */
function mapKind(fixtureKind: string): PressMediaKind {
  switch (fixtureKind) {
    case "brand-book":
      return "brand_book";
    case "logo":
      return "logo";
    case "wordmark":
      return "wordmark";
    case "photo":
      return "photo";
    case "boilerplate":
      return "boilerplate";
    default:
      // color_charter / graphic_charter n'existent pas dans les fixtures.
      return "boilerplate";
  }
}

export async function seedPress(
  prisma: PrismaClient,
): Promise<{ releases: number; assets: number }> {
  let releasesCreated = 0;

  // ── Communiqués ────────────────────────────────────────────────────────────
  for (let i = 0; i < PRESS_RELEASES.length; i++) {
    const r = PRESS_RELEASES[i]!;
    const existing = await prisma.pressReleaseTranslation.findUnique({
      where: { locale_slug: { locale: "fr", slug: r.slug } },
      select: { id: true },
    });
    if (existing) continue; // idempotent

    await prisma.pressRelease.create({
      data: {
        tag: r.tag,
        status: "published",
        publishedAt: new Date(r.publishedAt),
        sortOrder: i,
        translations: {
          create: [
            {
              locale: "fr",
              slug: r.slug,
              title: r.fr.title,
              dek: r.fr.dek,
              body: r.fr.body,
            },
            {
              locale: "en",
              slug: r.slug,
              title: r.en.title,
              dek: r.en.dek,
              body: r.en.body,
            },
          ],
        },
      },
    });
    releasesCreated++;
  }

  // ── Kit média (placeholders, fichier uploadé plus tard via l'admin) ──────────
  let assetsCreated = 0;
  const assetCount = await prisma.pressMediaAsset.count();
  if (assetCount === 0) {
    for (let i = 0; i < PRESS_KIT_ASSETS.length; i++) {
      const a = PRESS_KIT_ASSETS[i]!;
      await prisma.pressMediaAsset.create({
        data: {
          kind: mapKind(a.kind),
          status: "published",
          // pas de fichier seedé : Will uploade le vrai binaire depuis l'admin
          storagePath: null,
          fileFormat: a.format,
          sortOrder: i,
          translations: {
            create: [
              { locale: "fr", title: a.fr.title, description: a.fr.description },
              { locale: "en", title: a.en.title, description: a.en.description },
            ],
          },
        },
      });
      assetsCreated++;
    }
  }

  return { releases: releasesCreated, assets: assetsCreated };
}
