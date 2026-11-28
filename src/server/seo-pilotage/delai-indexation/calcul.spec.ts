import { describe, expect, it } from "vitest";
import { calculerDelais, medianeDelaiHeures } from "./calcul";

const pub = new Date("2026-11-20T10:00:00Z");
const art = (id: string, chemin: string) => ({ id, titre: id, chemin, publieLe: pub });

describe("délai d'indexation", () => {
  it("prend la première inspection PASS après la publication", () => {
    const [d] = calculerDelais(
      [art("a", "/fr/blog/a")],
      [
        { chemin: "/fr/blog/a", inspecteLe: new Date("2026-11-19T10:00:00Z"), verdict: "PASS" },
        { chemin: "/fr/blog/a", inspecteLe: new Date("2026-11-20T12:00:00Z"), verdict: "NEUTRAL" },
        { chemin: "/fr/blog/a", inspecteLe: new Date("2026-11-21T10:00:00Z"), verdict: "PASS" },
        { chemin: "/fr/blog/a", inspecteLe: new Date("2026-11-22T10:00:00Z"), verdict: "PASS" },
      ],
    );
    expect(d?.delaiHeures).toBe(24);
  });
  it("null tant qu'aucune inspection indexée", () => {
    const [d] = calculerDelais([art("a", "/fr/blog/a")], []);
    expect(d?.delaiHeures).toBeNull();
  });
  it("médiane sur 30 jours, ignore les inconnus et les anciens", () => {
    const now = new Date("2026-11-28T00:00:00Z");
    const mk = (h: number | null, publieLe = pub) => ({
      id: "x",
      titre: "x",
      chemin: "x",
      publieLe,
      delaiHeures: h,
      indexeVuLe: null,
    });
    expect(medianeDelaiHeures([mk(10), mk(30), mk(20), mk(null)], now)).toBe(20);
    expect(medianeDelaiHeures([mk(10), mk(30)], now)).toBe(20);
    expect(medianeDelaiHeures([mk(5, new Date("2026-09-01"))], now)).toBeNull();
  });
});
