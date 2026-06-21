import { describe, it, expect } from "vitest";
import {
  CLIENT_SECTORS,
  CLIENT_SECTOR_SLUGS,
  getClientSector,
  isClientSectorSlug,
  clientSectorLabel,
} from "@/content/sectors";
import { SECTOR_PAIN_MATRIX } from "@/server/content-gen/kb/sector-pain-matrix";
import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";

// Miroir runtime du type `BlogSector` (src/content/blog/types.ts:26). Si ce type
// change, ce test doit être mis à jour en conscience (garde anti-dérive).
const BLOG_SECTORS = [
  "industrie",
  "comptabilite",
  "juridique",
  "banque-finance",
  "conseil",
  "sante",
  "retail",
  "ecommerce",
  "logistique",
  "agro-alimentaire",
  "tech",
  "saas",
  "tourisme",
  "education",
  "immobilier",
  "autre",
] as const;

describe("SSOT secteurs client (src/content/sectors.ts)", () => {
  it("expose 10 secteurs sans doublon", () => {
    expect(CLIENT_SECTORS.length).toBe(10);
    expect(new Set(CLIENT_SECTOR_SLUGS).size).toBe(10);
  });

  it("aligne 1:1 sur l'enum Secteur de la pain-matrix (zéro dérive)", () => {
    const matrixSectors = new Set(SECTOR_PAIN_MATRIX.map((c) => c.secteur));
    const ssotSectors = new Set(CLIENT_SECTOR_SLUGS);
    // Tout secteur de la pain-matrix doit exister dans le SSOT…
    for (const s of matrixSectors) {
      expect(ssotSectors.has(s)).toBe(true);
    }
    // …et réciproquement (pas de secteur SSOT sans aucune entrée pain-matrix).
    for (const s of ssotSectors) {
      expect(matrixSectors.has(s)).toBe(true);
    }
  });

  it("chaque secteur mappe vers un BlogSector valide", () => {
    for (const s of CLIENT_SECTORS) {
      expect(BLOG_SECTORS).toContain(s.blogSector);
    }
  });

  it("chaque tag KB référencé existe dans KB_SECTOR_TAGS", () => {
    const kbSlugs = new Set(KB_SECTOR_TAGS.map((t) => t.slug));
    for (const s of CLIENT_SECTORS) {
      expect(s.kbSectorTags.length).toBeGreaterThan(0);
      for (const tag of s.kbSectorTags) {
        expect(kbSlugs.has(tag)).toBe(true);
      }
    }
  });

  it("helpers : lookup, garde de type, libellé", () => {
    expect(getClientSector("juridique")?.labelFr).toBe("Juridique");
    expect(getClientSector("inconnu")).toBeUndefined();
    expect(isClientSectorSlug("sante_medecine")).toBe(true);
    expect(isClientSectorSlug("nope")).toBe(false);
    expect(clientSectorLabel("btp_immobilier")).toBe("BTP & immobilier");
    expect(clientSectorLabel("brut")).toBe("brut");
  });
});
