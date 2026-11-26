// Fraîcheur des offres (Google for Jobs) — logique pure, et la liste
// statique à une seule entrée (page principale des apporteurs, B5 levée le 25/11/2026).
import { describe, it, expect, vi } from "vitest";

// Aucune offre en base : on isole ce que fait la liste statique à elle seule.
const offresEnBase = vi.fn(async (_a: unknown) => [] as unknown[]);
vi.mock("@/lib/prisma", () => ({
  prisma: { jobOffer: { findMany: (a: unknown) => offresEnBase(a) } },
}));

import { ageInDays, effectivePostedAt, isPostingStale } from "@/lib/careers/freshness";
import { JOB_OFFER_FRESHNESS_MAX_DAYS, STATIC_JOB_POSTINGS } from "@/content/recrutement/dates";
import { listStaleJobPostings } from "@/server/careers/freshness";

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

  // B5 levée le 25/11/2026 pour la SEULE page principale des apporteurs : une seule entrée
  // statique, `/memo-isere` reste exclue.
  it("déclare une seule offre statique : la page principale des apporteurs", () => {
    expect(STATIC_JOB_POSTINGS).toHaveLength(1);
    expect(STATIC_JOB_POSTINGS[0]!.path).toBe("/fr/devenir-commercial-ia");
    expect(STATIC_JOB_POSTINGS.some((s) => s.path.includes("memo-isere"))).toBe(false);
  });

  it("l'offre statique est fraîche le jour de sa publication, périmée 46 jours plus tard", async () => {
    offresEnBase.mockClear();
    const posteLe = new Date(STATIC_JOB_POSTINGS[0]!.datePosted);
    await expect(listStaleJobPostings(posteLe)).resolves.toEqual([]);
    const plusTard = new Date(posteLe.getTime() + 46 * 86_400_000);
    const perimees = await listStaleJobPostings(plusTard);
    expect(perimees).toHaveLength(1);
    expect(perimees[0]).toMatchObject({
      kind: "statique",
      slug: "/fr/devenir-commercial-ia",
      daysOld: 46,
    });
    // TÉMOIN — la base a bien été interrogée.
    expect(offresEnBase).toHaveBeenCalled();
  });
});
