/**
 * @vitest-environment node
 *
 * Amendement D / audit PR-2 point 2 : les 4 valeurs ajoutées par le Score (sector = autre,
 * region = outre-mer / non-precisee, barriers = none) ont un libellé lisible sur la page
 * Observatoire et dans l'export CSV : jamais la clé brute ni le slug nu.
 */
import { describe, it, expect, vi } from "vitest";
import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";
import { libelleValeurScore } from "@/lib/score-ia-pme/libelles";

const { latestMock } = vi.hoisted(() => ({ latestMock: vi.fn() }));
vi.mock("@/server/observatoire/snapshot", async (orig) => ({
  ...(await orig<typeof import("../snapshot")>()),
  readLatestSnapshot: latestMock,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

type Msgs = { observatoire: { questions: { barriers: { options: Record<string, string> } } } };

describe("libellés des valeurs ajoutées par le Score", () => {
  it("barriers.options.none existe en fr ET en en (pas de MISSING_MESSAGE)", () => {
    for (const m of [frMessages, enMessages] as unknown as Msgs[]) {
      const v = m.observatoire.questions.barriers.options.none;
      expect(typeof v).toBe("string");
      expect(v!.length).toBeGreaterThan(0);
    }
  });

  it("libelleValeurScore rend un libellé (≠ slug) pour autre, outre-mer, non-precisee", () => {
    for (const [source, slug] of [
      ["sector", "autre"],
      ["region", "outre-mer"],
      ["region", "non-precisee"],
    ] as const) {
      for (const lang of ["fr", "en"] as const) {
        const l = libelleValeurScore(source, slug, lang);
        expect(l).toBeTruthy();
        expect(l).not.toBe(slug);
      }
    }
    expect(libelleValeurScore("sector", "inconnu", "fr")).toBeUndefined();
  });

  it("CSV : aucun libellé n'est le slug nu ni une clé brute", async () => {
    latestMock.mockResolvedValue({
      totalResponses: 40,
      generatedAt: "2026-11-20T00:00:00.000Z",
      filter: { companySize: null, sector: null, region: null },
      distributions: {
        sector: [{ value: "autre", count: 10, pct: 25 }],
        region: [
          { value: "outre-mer", count: 5, pct: 12 },
          { value: "non-precisee", count: 5, pct: 12 },
        ],
        barriers: [{ value: "none", count: 8, pct: 20 }],
      },
      insights: {},
    });
    const { GET } = await import("@/app/api/observatoire/export-csv/route");
    const lignes = (await (await GET()).text()).split("\n");
    for (const slug of ["autre", "outre-mer", "non-precisee", "none"]) {
      const l = lignes.find((x) => x.includes(`,${slug},`));
      expect(l, slug).toBeDefined();
      const champs = l!.split(",");
      const iv = champs.indexOf(slug);
      expect(champs[iv + 1], `libellé de ${slug}`).not.toBe(slug);
      expect(champs[iv + 1]).not.toMatch(/^observatoire\./);
    }
  });
});
