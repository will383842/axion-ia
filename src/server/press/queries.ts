// Lectures publiques « Salle de presse » — communiqués + kit média.
//
// Doctrine Axion-IA :
//   - FR canonique, EN miroir (next-intl Locale "fr" | "en").
//   - Fallback fixtures : si la DB est vide (build stub.invalid OU DB pas
//     encore seedée), on retombe sur `src/content/press.ts` pour que /presse
//     ne soit JAMAIS cassé au build SSG (contrat ADR 0026).
//   - Les shapes exportées miroitent EXACTEMENT celles attendues par les
//     composants `PressReleases.tsx` / `PressKit.tsx`.

import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/routing";
import {
  PRESS_RELEASES,
  PRESS_KIT_ASSETS,
  type PressRelease as FixturePressRelease,
  type PressKitAsset as FixturePressKitAsset,
} from "@/content/press";
import type { PressReleaseTag, PressMediaKind } from "../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────
// Shapes publiques (consommées par les composants UI).
// ─────────────────────────────────────────────────────────────────

/** Carte communiqué — grille `/presse`. */
export interface PressReleaseCard {
  slug: string;
  /** ISO date string — `datePublished` JSON-LD + sitemap. */
  publishedAt: string;
  tag: PressReleaseTag;
  title: string;
  dek: string;
}

/** Communiqué complet — page détail `/presse/[slug]`. */
export interface PressReleaseFull {
  slug: string;
  publishedAt: string;
  tag: PressReleaseTag;
  title: string;
  dek: string;
  body: string;
}

/** Élément kit média — grille `PressKit`. */
export interface PressKitItem {
  id: string;
  kind: PressMediaKind;
  /** URL de téléchargement (route publique) ou `null` si placeholder. */
  fileUrl: string | null;
  /** Label format affiché dans le badge (ex. PDF, PNG, SVG). */
  format: string;
  title: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────
// Mapping enum kit fixtures (kebab) → enum Prisma (snake).
// Les fixtures utilisent "brand-book" alors que l'enum Prisma = "brand_book".
// ─────────────────────────────────────────────────────────────────
const FIXTURE_KIND_TO_PRISMA: Record<FixturePressKitAsset["kind"], PressMediaKind> = {
  logo: "logo",
  wordmark: "wordmark",
  photo: "photo",
  "brand-book": "brand_book",
  boilerplate: "boilerplate",
};

// ─────────────────────────────────────────────────────────────────
// Fallback mappers (fixtures → shape publique).
// ─────────────────────────────────────────────────────────────────
function fixtureToCard(r: FixturePressRelease, locale: Locale): PressReleaseCard {
  const t = r[locale];
  return { slug: r.slug, publishedAt: r.publishedAt, tag: r.tag, title: t.title, dek: t.dek };
}

function fixtureToFull(r: FixturePressRelease, locale: Locale): PressReleaseFull {
  const t = r[locale];
  return {
    slug: r.slug,
    publishedAt: r.publishedAt,
    tag: r.tag,
    title: t.title,
    dek: t.dek,
    body: t.body,
  };
}

function fixtureToKitItem(a: FixturePressKitAsset, locale: Locale): PressKitItem {
  const t = a[locale];
  return {
    id: a.id,
    kind: FIXTURE_KIND_TO_PRISMA[a.kind],
    fileUrl: a.fileUrl,
    format: a.format,
    title: t.title,
    description: t.description,
  };
}

// ─────────────────────────────────────────────────────────────────
// Communiqués publiés (cartes).
// ─────────────────────────────────────────────────────────────────
export async function getPublishedPressReleases(locale: Locale): Promise<PressReleaseCard[]> {
  const rows = await prisma.pressRelease.findMany({
    where: { status: "published", deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
    include: { translations: { where: { locale } } },
  });

  const mapped: PressReleaseCard[] = [];
  for (const row of rows) {
    const t = row.translations[0];
    if (!t) continue; // pas de traduction dans cette locale → skip
    mapped.push({
      slug: t.slug,
      publishedAt: (row.publishedAt ?? row.createdAt).toISOString().slice(0, 10),
      tag: row.tag,
      title: t.title,
      dek: t.dek ?? "",
    });
  }

  // Fallback fixtures : DB vide (build stub OU pas encore seedée).
  if (mapped.length === 0) {
    return PRESS_RELEASES.map((r) => fixtureToCard(r, locale));
  }
  return mapped;
}

// ─────────────────────────────────────────────────────────────────
// Communiqué par slug (complet).
// ─────────────────────────────────────────────────────────────────
export async function getPressReleaseBySlug(
  locale: Locale,
  slug: string,
): Promise<PressReleaseFull | null> {
  const t = await prisma.pressReleaseTranslation.findFirst({
    where: {
      locale,
      slug,
      release: { status: "published", deletedAt: null },
    },
    include: { release: true },
  });

  if (t) {
    return {
      slug: t.slug,
      publishedAt: (t.release.publishedAt ?? t.release.createdAt).toISOString().slice(0, 10),
      tag: t.release.tag,
      title: t.title,
      dek: t.dek ?? "",
      body: t.body,
    };
  }

  // Fallback fixtures.
  const fixture = PRESS_RELEASES.find((r) => r.slug === slug);
  return fixture ? fixtureToFull(fixture, locale) : null;
}

// ─────────────────────────────────────────────────────────────────
// Slugs publiés (generateStaticParams).
// ─────────────────────────────────────────────────────────────────
export async function getAllPublishedPressReleaseSlugs(locale: Locale): Promise<string[]> {
  const rows = await prisma.pressReleaseTranslation.findMany({
    where: {
      locale,
      release: { status: "published", deletedAt: null },
    },
    select: { slug: true },
  });

  if (rows.length === 0) {
    return PRESS_RELEASES.map((r) => r.slug);
  }
  return rows.map((r) => r.slug);
}

// ─────────────────────────────────────────────────────────────────
// Kit média publié.
// ─────────────────────────────────────────────────────────────────
export async function getPublishedPressMedia(locale: Locale): Promise<PressKitItem[]> {
  const rows = await prisma.pressMediaAsset.findMany({
    where: { status: "published", deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { translations: { where: { locale } } },
  });

  const mapped: PressKitItem[] = [];
  for (const row of rows) {
    const t = row.translations[0];
    if (!t) continue;
    mapped.push({
      id: row.id,
      kind: row.kind,
      // Fichier uploadé → route publique (créée ailleurs) ; sinon placeholder.
      fileUrl: row.storagePath ? `/api/presse/media/${row.id}` : null,
      format: (row.fileFormat ?? "").toUpperCase(),
      title: t.title,
      description: t.description ?? "",
    });
  }

  // Fallback fixtures.
  if (mapped.length === 0) {
    return PRESS_KIT_ASSETS.map((a) => fixtureToKitItem(a, locale));
  }
  return mapped;
}
