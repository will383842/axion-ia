import { describe, expect, it } from "vitest";

import {
  PAGES_STRATEGIQUES,
  choisirPages,
  prioriteDe,
  type CandidatInspection,
} from "../priorites";

const MAINTENANT = new Date("2026-11-27T05:00:00Z");
const jours = (n: number) => new Date(MAINTENANT.getTime() - n * 86_400_000);
const heures = (n: number) => new Date(MAINTENANT.getTime() - n * 3_600_000);

function page(p: Partial<CandidatInspection> & { chemin: string }): CandidatInspection {
  return {
    modifieLe: jours(300),
    derniereInspection: jours(40),
    impressions14: 50,
    impressionsPrecedentes14: 50,
    noindex: false,
    ...p,
  };
}

describe("ordre de priorité de la rotation", () => {
  it("1 : page publiée ou modifiée depuis moins de 48 h (et pas revue depuis)", () => {
    expect(prioriteDe(page({ chemin: "/fr/a", modifieLe: heures(10) }), MAINTENANT)).toBe(1);
    expect(prioriteDe(page({ chemin: "/fr/a", modifieLe: heures(60) }), MAINTENANT)).not.toBe(1);
    // déjà inspectée après la modification : plus de priorité 1
    expect(
      prioriteDe(
        page({ chemin: "/fr/a", modifieLe: heures(10), derniereInspection: heures(2) }),
        MAINTENANT,
      ),
    ).not.toBe(1);
  });

  it("2 : impressions qui chutent, ou nulles depuis 14 jours (une fois par semaine)", () => {
    expect(
      prioriteDe(
        page({ chemin: "/fr/a", impressions14: 10, impressionsPrecedentes14: 100 }),
        MAINTENANT,
      ),
    ).toBe(2);
    expect(
      prioriteDe(
        page({ chemin: "/fr/a", impressions14: 0, impressionsPrecedentes14: 0 }),
        MAINTENANT,
      ),
    ).toBe(2);
    // inspectée il y a 2 jours : pas de repassage quotidien
    expect(
      prioriteDe(
        page({
          chemin: "/fr/a",
          impressions14: 0,
          impressionsPrecedentes14: 0,
          derniereInspection: jours(2),
        }),
        MAINTENANT,
      ),
    ).toBeNull();
  });

  it("2 : pas de chute déclarée sous un plancher de bruit", () => {
    expect(
      prioriteDe(
        page({ chemin: "/fr/a", impressions14: 1, impressionsPrecedentes14: 4 }),
        MAINTENANT,
      ),
    ).not.toBe(2);
  });

  it("3 : les 15 pages stratégiques chaque semaine", () => {
    expect(PAGES_STRATEGIQUES).toHaveLength(15);
    const chemin = PAGES_STRATEGIQUES[0]!;
    expect(prioriteDe(page({ chemin, derniereInspection: jours(8) }), MAINTENANT)).toBe(3);
    expect(prioriteDe(page({ chemin, derniereInspection: jours(3) }), MAINTENANT)).toBeNull();
  });

  it("4 : jamais inspectée, puis la plus ancienne", () => {
    expect(prioriteDe(page({ chemin: "/fr/a", derniereInspection: null }), MAINTENANT)).toBe(4);
    expect(prioriteDe(page({ chemin: "/fr/a", derniereInspection: jours(40) }), MAINTENANT)).toBe(
      4,
    );
  });

  it("5 : noindex une fois par mois seulement", () => {
    expect(
      prioriteDe(
        page({ chemin: "/fr/a", noindex: true, derniereInspection: jours(31) }),
        MAINTENANT,
      ),
    ).toBe(5);
    expect(
      prioriteDe(
        page({ chemin: "/fr/a", noindex: true, derniereInspection: jours(10) }),
        MAINTENANT,
      ),
    ).toBeNull();
    expect(
      prioriteDe(page({ chemin: "/fr/a", noindex: true, derniereInspection: null }), MAINTENANT),
    ).toBe(5);
  });

  it("choisit dans l'ordre 1 → 5, à l'intérieur d'un rang la plus ancienne d'abord, borné par n", () => {
    const liste = [
      page({ chemin: "/fr/noindex", noindex: true, derniereInspection: null }),
      page({ chemin: "/fr/jamais", derniereInspection: null }),
      page({ chemin: "/fr/vieille", derniereInspection: jours(90) }),
      page({ chemin: "/fr/neuve", modifieLe: heures(5), derniereInspection: jours(5) }),
      page({ chemin: "/fr/chute", impressions14: 5, impressionsPrecedentes14: 100 }),
      page({ chemin: "/fr/recente", derniereInspection: jours(1) }),
    ];
    const tous = choisirPages(liste, MAINTENANT, 100).map((c) => c.chemin);
    expect(tous).toEqual(["/fr/neuve", "/fr/chute", "/fr/jamais", "/fr/vieille", "/fr/noindex"]);
    expect(choisirPages(liste, MAINTENANT, 2).map((c) => c.chemin)).toEqual([
      "/fr/neuve",
      "/fr/chute",
    ]);
    expect(choisirPages(liste, MAINTENANT, 0)).toEqual([]);
  });
});
