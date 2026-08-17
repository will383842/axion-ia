// Fraîcheur des offres (Google for Jobs) — logique pure.
import { describe, it, expect } from "vitest";
import { ageInDays, effectivePostedAt, isPostingStale } from "@/lib/careers/freshness";
import { JOB_OFFER_FRESHNESS_MAX_DAYS, STATIC_JOB_POSTINGS } from "@/content/recrutement/dates";

const NOW = new Date("2026-08-13T12:00:00.000Z");

describe("ageInDays", () => {
  it("compte des jours entiers", () => {
    expect(ageInDays(new Date("2026-08-12T11:00:00.000Z"), NOW)).toBe(1);
    expect(ageInDays(new Date("2026-08-13T00:00:00.000Z"), NOW)).toBe(0);
  });

  it("ne renvoie jamais un âge négatif (date future)", () => {
    expect(ageInDays(new Date("2026-08-20T00:00:00.000Z"), NOW)).toBe(0);
  });
});

describe("effectivePostedAt", () => {
  // Même règle que le JSON-LD (job-posting.ts) : publishedAt ?? datePosted —
  // si les deux divergeaient, la pastille compterait autre chose que ce que
  // Google voit.
  it("préfère publishedAt quand présent", () => {
    const published = new Date("2026-08-01T00:00:00.000Z");
    const posted = new Date("2026-06-09T00:00:00.000Z");
    expect(effectivePostedAt({ publishedAt: published, datePosted: posted })).toBe(published);
  });

  it("retombe sur datePosted sinon", () => {
    const posted = new Date("2026-06-09T00:00:00.000Z");
    expect(effectivePostedAt({ publishedAt: null, datePosted: posted })).toBe(posted);
  });
});

describe("isPostingStale", () => {
  it("strictement au-delà du seuil seulement", () => {
    const seuil = new Date(NOW.getTime() - JOB_OFFER_FRESHNESS_MAX_DAYS * 24 * 3600 * 1000);
    expect(isPostingStale(seuil, NOW)).toBe(false);
    const auDela = new Date(seuil.getTime() - 25 * 3600 * 1000);
    expect(isPostingStale(auDela, NOW)).toBe(true);
  });

  it("une offre du 9 juin est périmée au 13 août (65 j > 45 j)", () => {
    expect(isPostingStale(new Date("2026-06-09T00:00:00.000Z"), NOW)).toBe(true);
  });
});

describe("STATIC_JOB_POSTINGS", () => {
  it("chaque entrée porte une date ISO valide et un chemin FR", () => {
    for (const s of STATIC_JOB_POSTINGS) {
      expect(Number.isNaN(new Date(s.datePosted).getTime())).toBe(false);
      expect(s.path.startsWith("/fr/")).toBe(true);
    }
  });
});
