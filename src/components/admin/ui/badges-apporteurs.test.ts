import { describe, expect, it } from "vitest";

import { badgeApporteurs } from "./badges-apporteurs";
import { buildAdminNav } from "@/lib/admin-nav";

const BASE = "/fr/p";
const c = { presentations: 3, pieces: 2, releve: 1 };

describe("pastilles du menu « Apporteurs d'affaires »", () => {
  it("présentations à traiter sur « Entreprises présentées »", () => {
    expect(badgeApporteurs(`${BASE}/apporteurs/entreprises`, BASE, c)).toEqual({
      count: 3,
      tone: "danger",
      label: "présentations à traiter",
    });
  });
  it("pièces de vigilance déposées sur « Apporteurs signés »", () => {
    expect(badgeApporteurs(`${BASE}/apporteurs`, BASE, c)).toMatchObject({
      count: 2,
      label: "pièces de vigilance déposées",
    });
  });
  it("relevés du mois à émettre sur « Commissions apporteurs »", () => {
    expect(badgeApporteurs(`${BASE}/apporteurs/commissions`, BASE, c)).toMatchObject({
      count: 1,
      label: "relevés du mois à émettre",
    });
  });
  it("à zéro, ou sans compteurs : aucune pastille", () => {
    expect(
      badgeApporteurs(`${BASE}/apporteurs/entreprises`, BASE, {
        presentations: 0,
        pieces: 0,
        releve: 0,
      }),
    ).toBeNull();
    expect(badgeApporteurs(`${BASE}/apporteurs`, BASE, undefined)).toBeNull();
  });
  it("égalité exacte : un sous-écran ou une autre entrée ne capte rien", () => {
    expect(badgeApporteurs(`${BASE}/apporteurs/abc-123`, BASE, c)).toBeNull();
    expect(badgeApporteurs(`${BASE}/contacts/commercial`, BASE, c)).toBeNull();
  });
  it("les trois adresses existent bien dans le menu, groupe « apporteurs »", () => {
    const items = buildAdminNav("p");
    for (const suffixe of ["/apporteurs", "/apporteurs/entreprises", "/apporteurs/commissions"]) {
      const it = items.find((x) => x.href === `${BASE}${suffixe}`);
      expect(it?.group, suffixe).toBe("apporteurs");
    }
  });
});
