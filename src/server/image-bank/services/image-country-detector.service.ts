// Template : src/server/image-bank/services/image-country-detector.service.ts
//
// Détection déterministe ISO codes depuis title/alt/caption/keywords.
// Source : table `Country` (PRÉREQUIS Sprint 1 step 0a — 249 lignes seedées).

import { prisma } from "@/lib/prisma";

import type { ImageBankLocale } from "../constants";
import type { DetectCountryInput } from "../types";

interface LookupEntry {
  pattern: string;
  isoCode: string;
}

const ALIASES: ReadonlyArray<LookupEntry> = [
  { pattern: "USA", isoCode: "US" },
  { pattern: "U.S.A.", isoCode: "US" },
  { pattern: "U.S.", isoCode: "US" },
  { pattern: "UK", isoCode: "GB" },
  { pattern: "U.K.", isoCode: "GB" },
  { pattern: "Great Britain", isoCode: "GB" },
  { pattern: "Grande-Bretagne", isoCode: "GB" },
  { pattern: "UAE", isoCode: "AE" },
  { pattern: "Émirats Arabes Unis", isoCode: "AE" },
  { pattern: "South Korea", isoCode: "KR" },
  { pattern: "Corée du Sud", isoCode: "KR" },
  { pattern: "North Korea", isoCode: "KP" },
  { pattern: "Corée du Nord", isoCode: "KP" },
  { pattern: "République Tchèque", isoCode: "CZ" },
  { pattern: "Czech Republic", isoCode: "CZ" },
];

const COUNTRY_LOOKUP_CACHE_TTL_MS = 60 * 60 * 1000; // 1h
let cachedLookup: { entries: LookupEntry[]; expiresAt: number } | null = null;

export class ImageCountryDetectorService {
  async detect(image: DetectCountryInput): Promise<string[]> {
    const found = new Set<string>();

    if (image.geoRegion) {
      const iso = image.geoRegion.toUpperCase();
      if (await this.isValidIso(iso)) found.add(iso);
    }

    const haystack = [
      image.geoPlacename,
      image.keywordsPrimary,
      ...(image.keywordsSecondary ?? []),
      ...image.translations.flatMap((t) => [t.title, t.alt, t.caption ?? ""]),
    ]
      .filter(Boolean)
      .join(" ");

    const lookup = await this.buildLookup();
    for (const entry of lookup) {
      if (this.makeRegex(entry.pattern).test(haystack)) {
        found.add(entry.isoCode);
      }
    }

    return [...found];
  }

  async detectAndSave(imageId: string): Promise<string[]> {
    const image = await prisma.imageAsset.findUnique({
      where: { id: imageId },
      include: {
        translations: {
          select: { title: true, alt: true, caption: true },
        },
      },
    });
    if (!image) return [];

    let isoCodes = await this.detect({
      geoRegion: image.geoRegion,
      geoPlacename: image.geoPlacename,
      keywordsPrimary: image.keywordsPrimary,
      keywordsSecondary: image.keywordsSecondary as string[] | null,
      translations: image.translations,
    });

    // Default Axion-IA France-focus si rien détecté (sauf AI-generated qui peut être global)
    if (isoCodes.length === 0 && image.sourceType !== "ai_generated") {
      isoCodes = ["FR"];
    }

    await prisma.imageAsset.update({
      where: { id: imageId },
      data: { targetCountries: isoCodes },
    });

    return isoCodes;
  }

  invalidateCache(): void {
    cachedLookup = null;
  }

  private async buildLookup(): Promise<LookupEntry[]> {
    if (cachedLookup && cachedLookup.expiresAt > Date.now()) {
      return cachedLookup.entries;
    }

    const countries = await prisma.country.findMany({
      select: {
        isoCode: true,
        nameFr: true,
        nameEn: true,
        slugFr: true,
        slugEn: true,
      },
    });

    const entries: LookupEntry[] = [];
    for (const c of countries) {
      if (c.nameFr) entries.push({ pattern: c.nameFr, isoCode: c.isoCode });
      if (c.nameEn && c.nameEn !== c.nameFr) {
        entries.push({ pattern: c.nameEn, isoCode: c.isoCode });
      }
      if (c.slugFr) entries.push({ pattern: c.slugFr, isoCode: c.isoCode });
      if (c.slugEn && c.slugEn !== c.slugFr) {
        entries.push({ pattern: c.slugEn, isoCode: c.isoCode });
      }
    }
    entries.push(...ALIASES);

    entries.sort((a, b) => b.pattern.length - a.pattern.length);

    cachedLookup = { entries, expiresAt: Date.now() + COUNTRY_LOOKUP_CACHE_TTL_MS };
    return entries;
  }

  private async isValidIso(iso: string): Promise<boolean> {
    if (iso.length !== 2) return false;
    const country = await prisma.country.findUnique({ where: { isoCode: iso } });
    return !!country;
  }

  /**
   * Regex Unicode-safe avec word boundaries (`\p{L}`).
   * Empêche "France" de matcher dans "francement", "frances", etc.
   */
  private makeRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, "iu");
  }
}

export type { ImageBankLocale };
