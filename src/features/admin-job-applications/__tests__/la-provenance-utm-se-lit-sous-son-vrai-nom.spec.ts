// La provenance UTM se lit sous son vrai nom : `utm_source`.
//
// ── Le défaut (constaté le 2026-09-19) ────────────────────────────────────
// Le cookie d'attribution (`src/lib/utm.ts`) porte les noms des paramètres
// d'URL — `utm_source`, `utm_campaign`… — et les actions du tunnel le recopient
// TEL QUEL dans `details.funnel.utm`. L'écran « quelle annonce rapporte ? »
// lisait `utm.source`, que rien n'écrit : chaque candidature ressortait
// « Aucun UTM », celles de Le Bon Coin comprises. Le tableau avait l'air vide
// d'attribution, alors que l'attribution était en base.

import { describe, it, expect, vi, beforeEach } from "vitest";

const lire = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { findMany: (a: unknown) => lire(a) } },
}));

const { getAnnoncesStats } = await import("../annonces-stats");

const LE = new Date("2026-09-10T10:00:00Z");

function candidature(utm: Record<string, string> | undefined) {
  return {
    submittedAt: LE,
    details: {
      unifiedType: "recrutement",
      subType: "candidature-commerciale",
      ...(utm ? { funnel: { utm } } : {}),
    },
  };
}

beforeEach(() => {
  lire.mockReset();
});

describe("getAnnoncesStats — ventilation par utm_source", () => {
  it("`funnel.utm.utm_source: leboncoin` est ventilé en leboncoin, pas en « Aucun UTM »", async () => {
    lire.mockResolvedValue([candidature({ utm_source: "leboncoin", utm_medium: "annonce" })]);
    const s = await getAnnoncesStats();
    expect(s.parUtmSource.map((r) => r.id)).toEqual(["leboncoin"]);
    expect(s.parUtmSource[0]?.candidatures).toBe(1);
  });

  it("lit encore `source` en repli, pour une ligne ancienne qui le porterait", async () => {
    lire.mockResolvedValue([candidature({ source: "indeed" })]);
    const s = await getAnnoncesStats();
    expect(s.parUtmSource.map((r) => r.id)).toEqual(["indeed"]);
  });

  it("sans UTM, la candidature reste dans « Aucun UTM » et compte comme sans provenance", async () => {
    lire.mockResolvedValue([candidature(undefined)]);
    const s = await getAnnoncesStats();
    expect(s.parUtmSource.map((r) => r.label)).toEqual(["Aucun UTM"]);
    expect(s.sansProvenance).toBe(1);
  });
});
