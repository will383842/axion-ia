/**
 * Tests — le fixe récupérable d'un formateur salarié.
 *
 * 🔑 C'est un calcul d'ARGENT : une erreur ici se retrouve sur un bulletin de
 * paie, et elle se découvre par le salarié, pas par un test. Le scénario de
 * référence est celui que Will a tranché le 2026-09-12, repris ici chiffre pour
 * chiffre — il fait foi sur toute interprétation du code.
 */

import { describe, expect, it } from "vitest";

import { deroulerAvanceRecuperable, synthetiser } from "./avance-recuperable";

const FIXE = 200_000; // 2 000,00 €

describe("le scénario de référence, chiffre pour chiffre", () => {
  /**
   * Mois 1 : fixe 2 000 · commissions 1 500  →  versé 2 000        · dette 500
   * Mois 2 : fixe 2 000 · commissions 2 500  →  versé 2 000        · dette 0
   * Mois 3 : fixe 2 000 · commissions 3 000  →  versé 3 000 (+1000) · dette 0
   */
  const mois = [
    { year: 2026, month: 1, fixeCents: FIXE, commissionsCents: 150_000 },
    { year: 2026, month: 2, fixeCents: FIXE, commissionsCents: 250_000 },
    { year: 2026, month: 3, fixeCents: FIXE, commissionsCents: 300_000 },
  ];

  it("🔴 déroule les trois mois exactement comme décidé", () => {
    const r = deroulerAvanceRecuperable(mois);

    // Mois 1 — commissions SOUS le fixe : rien en plus, une dette de 500.
    expect(r[0]!.complementCents).toBe(0);
    expect(r[0]!.detteSortanteCents).toBe(50_000);

    // Mois 2 — 500 d'excédent, intégralement absorbés par la dette.
    expect(r[1]!.detteEntranteCents).toBe(50_000);
    expect(r[1]!.remboursementCents).toBe(50_000);
    expect(r[1]!.complementCents).toBe(0);
    expect(r[1]!.detteSortanteCents).toBe(0);

    // Mois 3 — plus de dette : l'excédent se verse entièrement.
    expect(r[2]!.complementCents).toBe(100_000);
    expect(r[2]!.detteSortanteCents).toBe(0);
  });

  it("🔑 CONTRE-TÉMOIN : SANS report, le mois 2 verserait 500 de trop", () => {
    // C'est la différence exacte entre les deux options soumises à Will. Si le
    // report disparaissait du code, le mois 2 rendrait 500 € de complément au
    // lieu de 0 — et personne ne le verrait, puisque les deux comportements
    // sont plausibles. Ce test EST la décision.
    const r = deroulerAvanceRecuperable(mois);
    const sansReport = 250_000 - FIXE; // ce que rendrait un calcul mois par mois
    expect(sansReport).toBe(50_000);
    expect(r[1]!.complementCents).not.toBe(sansReport);
    expect(r[1]!.complementCents).toBe(0);
  });
});

describe("les invariants du calcul", () => {
  it("🔴 le complément n'est JAMAIS négatif", () => {
    // Un mois creux ne REPREND pas le fixe déjà versé. Rendre un nombre négatif
    // aurait laissé un appelant le soustraire d'une paie — c'est-à-dire retirer
    // de l'argent à quelqu'un sur la foi d'un signe.
    const r = deroulerAvanceRecuperable([
      { year: 2026, month: 1, fixeCents: FIXE, commissionsCents: 0 },
    ]);
    expect(r[0]!.complementCents).toBe(0);
    expect(r[0]!.detteSortanteCents).toBe(FIXE);
  });

  it("🔴 l'ORDRE des mois ne change pas le résultat — il est imposé", () => {
    // Chaque mois dépend de la dette du précédent : une liste désordonnée
    // donnerait un résultat faux SANS LEVER. Le tri est dans la fonction, pas
    // dans la confiance qu'on fait à l'appelant.
    const desordre = [
      { year: 2026, month: 3, fixeCents: FIXE, commissionsCents: 300_000 },
      { year: 2026, month: 1, fixeCents: FIXE, commissionsCents: 150_000 },
      { year: 2026, month: 2, fixeCents: FIXE, commissionsCents: 250_000 },
    ];
    const r = deroulerAvanceRecuperable(desordre);
    expect(r.map((x) => x.month)).toEqual([1, 2, 3]);
    expect(r[2]!.complementCents).toBe(100_000);
  });

  it("🔑 la dette traverse une ANNÉE sans se remettre à zéro", () => {
    // Décembre creux, janvier fort : le rattrapage doit franchir le changement
    // d'année. Un tri sur le seul mois l'aurait cassé en silence.
    const r = deroulerAvanceRecuperable([
      { year: 2026, month: 12, fixeCents: FIXE, commissionsCents: 100_000 },
      { year: 2027, month: 1, fixeCents: FIXE, commissionsCents: 300_000 },
    ]);
    expect(r[0]!.detteSortanteCents).toBe(100_000);
    expect(r[1]!.remboursementCents).toBe(100_000);
    expect(r[1]!.complementCents).toBe(0);
  });

  it("reprend une dette constituée avant le premier mois de la liste", () => {
    const r = deroulerAvanceRecuperable(
      [{ year: 2026, month: 6, fixeCents: FIXE, commissionsCents: 260_000 }],
      40_000,
    );
    expect(r[0]!.detteEntranteCents).toBe(40_000);
    expect(r[0]!.remboursementCents).toBe(40_000);
    expect(r[0]!.complementCents).toBe(20_000);
  });

  it("un fixe à ZÉRO rend le commissionnement intégralement dû", () => {
    // Le cas d'un salarié sans part fixe commissionnée : rien à rembourser,
    // tout se verse. Sans ce test, une division ou un `Math.max` mal placé
    // pourrait avaler la totalité du commissionnement.
    const r = deroulerAvanceRecuperable([
      { year: 2026, month: 1, fixeCents: 0, commissionsCents: 180_000 },
    ]);
    expect(r[0]!.complementCents).toBe(180_000);
    expect(r[0]!.detteSortanteCents).toBe(0);
  });

  it("🔑 la dette ne devient jamais négative, même sur une série de mois forts", () => {
    const r = deroulerAvanceRecuperable([
      { year: 2026, month: 1, fixeCents: FIXE, commissionsCents: 900_000 },
      { year: 2026, month: 2, fixeCents: FIXE, commissionsCents: 900_000 },
    ]);
    for (const m of r) expect(m.detteSortanteCents).toBeGreaterThanOrEqual(0);
    expect(r[1]!.complementCents).toBe(700_000);
  });
});

describe("synthetiser — le chiffre que la paie attend", () => {
  it("rend le complément du dernier mois ET la dette restante", () => {
    // 🔑 Les DEUX, jamais l'un sans l'autre. « Zéro complément » trois mois
    // d'affilée se lit « il n'a rien gagné en plus » et cache qu'il rembourse
    // une avance — c'est le genre d'opacité qui finit en litige.
    const s = synthetiser(
      deroulerAvanceRecuperable([
        { year: 2026, month: 1, fixeCents: FIXE, commissionsCents: 100_000 },
        { year: 2026, month: 2, fixeCents: FIXE, commissionsCents: 120_000 },
      ]),
    );
    expect(s.complementDuMoisCents).toBe(0);
    expect(s.detteCents).toBe(180_000);
    expect(s.dernierMois?.month).toBe(2);
  });

  it("cumule les compléments réellement versés", () => {
    const s = synthetiser(
      deroulerAvanceRecuperable([
        { year: 2026, month: 1, fixeCents: FIXE, commissionsCents: 250_000 },
        { year: 2026, month: 2, fixeCents: FIXE, commissionsCents: 230_000 },
      ]),
    );
    expect(s.complementsCumulesCents).toBe(50_000 + 30_000);
  });

  it("une liste vide ne rend pas d'argent", () => {
    const s = synthetiser([]);
    expect(s.complementDuMoisCents).toBe(0);
    expect(s.detteCents).toBe(0);
    expect(s.dernierMois).toBeNull();
  });
});
