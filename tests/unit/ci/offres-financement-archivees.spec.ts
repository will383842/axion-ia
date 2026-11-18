/**
 * Les 3 offres consacrées au financement sont ARCHIVÉES (statut seulement, données gardées) :
 * elles ne doivent plus être servies en 200. 301 vers le hub, 404 de la page, hors sitemap,
 * hors JSON-LD JobPosting. Plan : PLAN-RETRAIT-FINANCEMENT.md (axion-plans-prive).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { JobOffer } from "../../../prisma/generated/client";
import { isJobOfferArchived, isJobOfferIndexable, isOfferOpen } from "@/lib/careers/job-offers";
import { buildJobPostingJsonLd } from "@/lib/seo/job-posting";
import { SLUGS_OFFRES_ARCHIVEES } from "@/server/content-gen/retrait-financement/plan";

const RACINE = join(__dirname, "..", "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

describe("offres de financement archivées", () => {
  it.each([...SLUGS_OFFRES_ARCHIVEES, "assistant-financements-qualiopi"])(
    "301 permanent vers /fr/carrieres pour %s (page et postuler)",
    (slug) => {
      const cfg = lire("next.config.ts");
      expect(cfg).toContain(slug);
      expect(cfg).toMatch(
        /source:\s*"\/:locale\(fr\|en\)\/carrieres\/:slug\([^"]*\)",\s*destination: "\/fr\/carrieres",\s*permanent: true/,
      );
      expect(cfg).toMatch(
        /\/:locale\(fr\|en\)\/carrieres\/:slug\([^"]*\)\/postuler",\s*destination: "\/fr\/carrieres",\s*permanent: true/,
      );
    },
  );

  it("la page détail répond notFound() pour une offre archivée (metadata noindex aussi)", () => {
    const page = lire("src/app/[locale]/carrieres/[slug]/page.tsx");
    expect(page).toMatch(/if \(!offer \|\| isJobOfferArchived\(offer\)\) notFound\(\);/);
    expect(page).toMatch(/if \(!offer \|\| isJobOfferArchived\(offer\)\) return \{ robots/);
  });

  const archivee = {
    id: "x",
    slug: "charge-subventions",
    status: "archived",
    indexationTier: "tier_1_indexable",
    filledAt: null,
    validThrough: null,
    titleFr: "t",
    titleEn: "t",
    bodyFr: "<p>b</p>",
    bodyEn: "<p>b</p>",
  } as unknown as JobOffer;

  it("archivée : ni indexable, ni ouverte, ni JobPosting", () => {
    expect(isJobOfferArchived(archivee)).toBe(true);
    expect(isJobOfferIndexable(archivee)).toBe(false);
    expect(isOfferOpen(archivee)).toBe(false);
    expect(buildJobPostingJsonLd(archivee, "fr")).toBeNull();
  });

  it("le sitemap et la liste des slugs ne lisent que les offres publiées", () => {
    expect(lire("src/app/sitemap-carrieres.xml/route.ts")).toMatch(/status: "published"/);
    expect(lire("src/lib/careers/job-offers.ts")).toMatch(
      /listIndexableJobOfferSlugs[\s\S]*status: "published"/,
    );
  });
});
