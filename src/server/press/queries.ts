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
import type { ImageAsset, ImageAssetTranslation } from "../../../prisma/generated/client";
import { PRESS_KIT_ASSETS, type PressKitAsset as FixturePressKitAsset } from "@/content/press";
import type {
  PressReleaseTag,
  PressMediaKind,
  PressReleaseAudience,
  Prisma,
} from "../../../prisma/generated/client";

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
  /** URL de téléchargement du PDF (route publique) ou `null` (legacy fixtures). */
  pdfUrl: string | null;
  /** Taxonomie ciblage média (2026-06-24). Slug région SSOT ou `null`. */
  region: string | null;
  /** Code INSEE département (texte) ou `null`. */
  departement: string | null;
  /** Slug secteur SSOT ou `null`. */
  sector: string | null;
  /** Audience visée (`GENERAL` | `FOUNDER`). */
  audience: PressReleaseAudience;
}

/**
 * Filtres facettés « ciblage média » pour la grille publique `/presse`.
 * Chaque clé absente (`undefined`) ⇒ pas de filtre sur cette facette.
 */
export interface PressReleaseFilters {
  /** Slug région SSOT (`src/content/regions.ts`). */
  region?: string;
  /** Slug secteur SSOT (`src/content/knowledge/sector-tags.ts`). */
  sector?: string;
  /** Audience visée. */
  audience?: PressReleaseAudience;
}

/** Communiqué complet — page détail `/presse/[slug]`. */
export interface PressReleaseFull {
  slug: string;
  publishedAt: string;
  tag: PressReleaseTag;
  title: string;
  dek: string;
  /**
   * Corps texte — legacy fixtures uniquement. Les communiqués PDF n'ont plus de
   * `body` (null) ; l'affichage se fait via `pdfUrl`.
   */
  body: string;
  /** URL du PDF (route publique) ou `null` (legacy fixtures texte). */
  pdfUrl: string | null;
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
  "color-charter": "color_charter",
  boilerplate: "boilerplate",
};

// ─────────────────────────────────────────────────────────────────
// Fallback mapper kit média (fixtures → shape publique). Conservé pour le kit
// (vrais logos de marque) ; PLUS de fallback pour les communiqués (admin-only).
// ─────────────────────────────────────────────────────────────────
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
export async function getPublishedPressReleases(
  locale: Locale,
  filters: PressReleaseFilters = {},
): Promise<PressReleaseCard[]> {
  // Communiqués = UNIQUEMENT ceux publiés depuis la console admin (décision Will
  // 2026-06-23). Pas de fallback fixtures : tant que rien n'est publié, la
  // section affiche son état vide. try/catch défensif : une table absente
  // (migration non appliquée) ne doit jamais casser /presse — on rend vide.
  //
  // Filtres « ciblage média » (2026-06-24) appliqués côté SQL (AND). Chaque
  // facette absente ⇒ pas de filtre. Les colonnes filtrées sont indexées.
  try {
    const where: Prisma.PressReleaseWhereInput = {
      status: "published",
      deletedAt: null,
      ...(filters.region ? { region: filters.region } : {}),
      ...(filters.sector ? { sector: filters.sector } : {}),
      ...(filters.audience ? { audience: filters.audience } : {}),
    };

    const rows = await prisma.pressRelease.findMany({
      where,
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
        pdfUrl: row.pdfStoragePath ? `/api/presse/communique/${row.id}` : null,
        region: row.region ?? null,
        departement: row.departement ?? null,
        sector: row.sector ?? null,
        audience: row.audience,
      });
    }
    return mapped;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Communiqué par slug (complet).
// ─────────────────────────────────────────────────────────────────
export async function getPressReleaseBySlug(
  locale: Locale,
  slug: string,
): Promise<PressReleaseFull | null> {
  try {
    const t = await prisma.pressReleaseTranslation.findFirst({
      where: {
        locale,
        slug,
        release: { status: "published", deletedAt: null },
      },
      include: { release: true },
    });
    if (!t) return null; // slug inconnu → 404 (plus de fallback fixtures, admin-only)
    return {
      slug: t.slug,
      publishedAt: (t.release.publishedAt ?? t.release.createdAt).toISOString().slice(0, 10),
      tag: t.release.tag,
      title: t.title,
      dek: t.dek ?? "",
      // `body` est désormais optionnel (PDF-based) → fallback "" pour les
      // communiqués PDF (le rendu utilise `pdfUrl` à la place).
      body: t.body ?? "",
      pdfUrl: t.release.pdfStoragePath ? `/api/presse/communique/${t.release.id}` : null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Slugs publiés (generateStaticParams).
// ─────────────────────────────────────────────────────────────────
export async function getAllPublishedPressReleaseSlugs(locale: Locale): Promise<string[]> {
  try {
    const rows = await prisma.pressReleaseTranslation.findMany({
      where: {
        locale,
        release: { status: "published", deletedAt: null },
      },
      select: { slug: true },
    });
    return rows.map((r) => r.slug);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Kit média publié.
// ─────────────────────────────────────────────────────────────────
/** Clé de rapprochement fixture ↔ asset console : titre normalisé (casse/accents). */
function normalizeKitTitle(title: string): string {
  // `\p{M}` (marques Unicode) après NFD, plutôt qu'une plage de diacritiques
  // combinants écrite en dur : ces caractères-là sont invisibles dans un éditeur
  // et ne survivent pas à un aller-retour d'encodage.
  return title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function getPublishedPressMedia(locale: Locale): Promise<PressKitItem[]> {
  // Kit média = assets console PUIS fixtures restantes.
  //
  // 🔴 Ne PAS revenir à un fallback tout-ou-rien (« fixtures seulement si la DB
  // est vide »). C'était le comportement d'origine, et il posait un piège de
  // production : les logos, le boilerplate et le portrait du fondateur ne
  // vivent QUE dans les fixtures — le premier upload console (un brand book,
  // par exemple) les faisait tous disparaître d'un coup de la salle de presse,
  // sans qu'aucun écran n'annonce la substitution.
  //
  // Règle de fusion, dans cet ordre :
  //   1. les assets publiés en console (l'admin fait autorité, `sortOrder` d'abord) ;
  //   2. les fixtures qu'aucun asset console ne remplace :
  //      - même titre normalisé  ⇒ la fixture s'efface (remplacement explicite) ;
  //      - fixture placeholder (`fileUrl: null`) et un asset console porte déjà
  //        ce `kind` ⇒ la fixture s'efface (la promesse est tenue par un vrai fichier).
  //
  // try/catch : table absente (migration non appliquée) → fixtures seules plutôt
  // que crash.
  try {
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

    return [...mapped, ...remainingFixtures(mapped, locale)];
  } catch {
    return PRESS_KIT_ASSETS.map((a) => fixtureToKitItem(a, locale));
  }
}

/**
 * Fixtures que les assets console ne remplacent pas. Voir la règle de fusion
 * documentée sur `getPublishedPressMedia`.
 */
function remainingFixtures(published: ReadonlyArray<PressKitItem>, locale: Locale): PressKitItem[] {
  const publishedTitles = new Set(published.map((p) => normalizeKitTitle(p.title)));
  const publishedKinds = new Set(published.filter((p) => p.fileUrl).map((p) => p.kind));

  return PRESS_KIT_ASSETS.map((a) => fixtureToKitItem(a, locale)).filter((f) => {
    if (publishedTitles.has(normalizeKitTitle(f.title))) return false;
    if (!f.fileUrl && publishedKinds.has(f.kind)) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────
// Banque d'images — aperçu pour l'espace presse.
//
// Réutilise la MÊME shape `ImageAsset & { translations }` que la galerie publique
// (`GalleryGrid`) afin de rendre de VRAIS visuels (au lieu de chemins hardcodés).
// Featured d'abord, puis les plus embarqués. Stub-aware : au build `stub.invalid`
// le proxy Prisma renvoie [] → la page retombe sur le bloc promo (fallback).
// ─────────────────────────────────────────────────────────────────
export type PressGalleryImage = ImageAsset & { translations: ImageAssetTranslation[] };

export async function getPressGalleryImages(
  locale: Locale,
  limit = 8,
): Promise<PressGalleryImage[]> {
  try {
    return await prisma.imageAsset.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        publishedAt: { not: null },
        translations: { some: { languageCode: locale, isPublished: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { embedCount: "desc" }, { publishedAt: "desc" }],
      take: limit,
      include: { translations: { where: { languageCode: locale }, take: 1 } },
    });
  } catch {
    return [];
  }
}
